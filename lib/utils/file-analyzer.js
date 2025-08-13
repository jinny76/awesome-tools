const fs = require('fs');
const path = require('path');
const { shouldExcludeFile } = require('./common');

// 判断是否为Node模块
function isNodeModule(modulePath) {
  // 跳过npm包和node内置模块
  if (!modulePath) return true;
  
  // 相对路径和绝对路径不是node模块
  if (modulePath.startsWith('.') || modulePath.startsWith('/')) {
    return false;
  }
  
  // 以@开头的可能是alias或scoped package
  if (modulePath.startsWith('@')) {
    const parts = modulePath.split('/');
    // 真正的scoped package通常只有2个部分，如 @vue/cli, @babel/core
    // 而alias路径通常有更多部分，如 @/event/pipeline3/LineNet3
    if (parts.length === 2 && !parts[1].includes('.')) {
      return true; // scoped package like @vue/cli
    }
    return false; // 可能是alias或更深的路径
  }
  
  // 常见的node模块模式
  const nodeModulePatterns = [
    /^[a-z]/,              // 以小写字母开头
    /^[A-Z]/,              // 以大写字母开头的模块
    /^\d/,                 // 以数字开头
    /^_/,                  // 以下划线开头
  ];
  
  // 如果包含点号，很可能是文件路径
  if (modulePath.includes('.') && modulePath.match(/\.(vue|js|jsx|ts|tsx)$/)) {
    return false;
  }
  
  // 检查是否匹配node模块模式
  const isNodeLike = nodeModulePatterns.some(pattern => pattern.test(modulePath));
  
  // 如果不包含路径分隔符且匹配node模块模式，则认为是node模块
  return isNodeLike && !modulePath.includes('/');
}

// 分析单个文件内容
function analyzeFileContent(content, file) {
  const imports = [];
  const exports = [];
  
  // Vue SFC处理
  if (file.extension === '.vue') {
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      content = scriptMatch[1];
    }
  }
  
  // 匹配ES6导入 - 改进版本以捕获更多细节，支持多行
  const importPatterns = [
    // import defaultExport from 'module'
    /import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/gs,
    // import * as name from 'module'
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/gs,
    // import { export1, export2 } from 'module' (支持多行)
    /import\s+\{\s*([\s\S]*?)\s*\}\s+from\s+['"`]([^'"`]+)['"`]/gs,
    // import defaultExport, { export1, export2 } from 'module' (支持多行)
    /import\s+(\w+)\s*,\s*\{\s*([\s\S]*?)\s*\}\s+from\s+['"`]([^'"`]+)['"`]/gs,
    // import 'module' (side effects only)
    /import\s+['"`]([^'"`]+)['"`]/gs
  ];
  
  let match;
  for (const pattern of importPatterns) {
    while ((match = pattern.exec(content)) !== null) {
      let modulePath, importedItems = [];
      
      if (pattern === importPatterns[0]) {
        // default import
        modulePath = match[2];
        importedItems = [{ name: match[1], type: 'default' }];
      } else if (pattern === importPatterns[1]) {
        // namespace import
        modulePath = match[2];
        importedItems = [{ name: match[1], type: 'namespace' }];
      } else if (pattern === importPatterns[2]) {
        // named imports
        modulePath = match[2];
        const namedImports = match[1].split(',').map(item => {
          const parts = item.trim().split(/\s+as\s+/);
          return {
            name: parts[0].trim(),
            alias: parts[1] ? parts[1].trim() : undefined,
            type: 'named'
          };
        });
        importedItems = namedImports;
      } else if (pattern === importPatterns[3]) {
        // mixed import
        modulePath = match[3];
        importedItems = [
          { name: match[1], type: 'default' },
          ...match[2].split(',').map(item => ({
            name: item.trim(),
            type: 'named'
          }))
        ];
      } else if (pattern === importPatterns[4]) {
        // side effects only
        modulePath = match[1];
        importedItems = [{ name: '*', type: 'side-effect' }];
      }
      
      if (modulePath && !isNodeModule(modulePath)) {
        imports.push({
          from: modulePath,
          type: 'es6',
          items: importedItems
        });
      }
    }
  }
  
  // 匹配require
  const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const modulePath = match[1];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'commonjs',
        items: [{ name: '*', type: 'require' }]
      });
    }
  }
  
  // 匹配动态导入 import()
  const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const modulePath = match[1];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'dynamic',
        items: [{ name: '*', type: 'dynamic' }]
      });
    }
  }
  
  // 匹配模板字符串中的动态导入
  const templateImportRegex = /import\s*\(\s*`([^`]+)`\s*\)/g;
  while ((match = templateImportRegex.exec(content)) !== null) {
    const modulePath = match[1];
    // 处理模板字符串中的变量 ${var} -> *
    const cleanPath = modulePath.replace(/\$\{[^}]+\}/g, '*');
    if (!isNodeModule(cleanPath)) {
      imports.push({
        from: cleanPath,
        type: 'dynamic-template',
        items: [{ name: '*', type: 'dynamic-template' }]
      });
    }
  }
  
  // 匹配Vue Router的懒加载
  const vueRouterRegex = /component\s*:\s*(?:\(\)\s*=>\s*)?import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  while ((match = vueRouterRegex.exec(content)) !== null) {
    const modulePath = match[1];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'vue-router',
        items: [{ name: 'default', type: 'vue-component' }]
      });
    }
  }
  
  // 匹配require.ensure (webpack代码分割)
  const requireEnsureRegex = /require\.ensure\s*\([^,]*,\s*(?:function\s*\([^)]*\)\s*{[^}]*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|.*?require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g;
  while ((match = requireEnsureRegex.exec(content)) !== null) {
    const modulePath = match[1] || match[2];
    if (modulePath && !isNodeModule(modulePath)) {
      imports.push({
        from: modulePath,
        type: 'require-ensure',
        items: [{ name: '*', type: 'ensure' }]
      });
    }
  }
  
  // 检测字符串中可能的文件路径(更保守的方法)
  const stringPathRegex = /['"`](\.[/\\][^'"`]*\.(?:vue|js|jsx|ts|tsx))['"`]/g;
  while ((match = stringPathRegex.exec(content)) !== null) {
    const potentialPath = match[1];
    // 确保这不是已经被其他规则捕获的导入
    const alreadyCaptured = imports.some(imp => imp.from === potentialPath);
    if (!alreadyCaptured) {
      imports.push({
        from: potentialPath,
        type: 'string-reference',
        items: [{ name: '*', type: 'string-ref' }]
      });
    }
  }
  
  // 改进的导出分析
  const exportPatterns = [
    // export default function/class/const/let/var name
    /export\s+default\s+(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g,
    // export default expression
    /export\s+default\s+(\w+)/g,
    // export function/class/const/let/var name
    /export\s+(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g,
    // export { name1, name2 as alias }
    /export\s*\{\s*([^}]+)\s*\}/g,
    // export { name } from 'module'
    /export\s*\{\s*([^}]+)\s*\}\s*from\s*['"`]([^'"`]+)['"`]/g,
    // export * from 'module'
    /export\s*\*\s*from\s*['"`]([^'"`]+)['"`]/g,
    // export * as name from 'module'
    /export\s*\*\s*as\s+(\w+)\s*from\s*['"`]([^'"`]+)['"`]/g
  ];
  
  for (const pattern of exportPatterns) {
    while ((match = pattern.exec(content)) !== null) {
      if (pattern === exportPatterns[0]) {
        // export default with declaration
        const name = match.slice(1).find(group => group !== undefined);
        if (name) {
          exports.push({ name, type: 'default', declared: true });
        }
      } else if (pattern === exportPatterns[1]) {
        // export default expression
        exports.push({ name: match[1], type: 'default', declared: false });
      } else if (pattern === exportPatterns[2]) {
        // export declaration
        const name = match.slice(1).find(group => group !== undefined);
        if (name) {
          exports.push({ name, type: 'named', declared: true });
        }
      } else if (pattern === exportPatterns[3]) {
        // export { ... }
        const exportList = match[1].split(',');
        for (const exp of exportList) {
          const parts = exp.trim().split(/\s+as\s+/);
          const originalName = parts[0].trim();
          const exportedName = parts[1] ? parts[1].trim() : originalName;
          
          if (originalName) {
            exports.push({
              name: exportedName,
              originalName: originalName !== exportedName ? originalName : undefined,
              type: 'named',
              declared: false
            });
          }
        }
      } else if (pattern === exportPatterns[4]) {
        // export { ... } from 'module'
        const modulePath = match[2];
        if (!isNodeModule(modulePath)) {
          const exportList = match[1].split(',');
          for (const exp of exportList) {
            const parts = exp.trim().split(/\s+as\s+/);
            const importedName = parts[0].trim();
            const exportedName = parts[1] ? parts[1].trim() : importedName;
            
            // 这是一个re-export，也要记录为导入
            imports.push({
              from: modulePath,
              type: 're-export',
              items: [{ name: importedName, type: 're-export', exportedAs: exportedName }]
            });
            
            exports.push({
              name: exportedName,
              type: 'named',
              reExportFrom: modulePath,
              declared: false
            });
          }
        }
      } else if (pattern === exportPatterns[5]) {
        // export * from 'module'
        const modulePath = match[1];
        if (!isNodeModule(modulePath)) {
          imports.push({
            from: modulePath,
            type: 're-export-all',
            items: [{ name: '*', type: 're-export-all' }]
          });
          
          exports.push({
            name: '*',
            type: 'namespace',
            reExportFrom: modulePath,
            declared: false
          });
        }
      } else if (pattern === exportPatterns[6]) {
        // export * as name from 'module'
        const name = match[1];
        const modulePath = match[2];
        if (!isNodeModule(modulePath)) {
          imports.push({
            from: modulePath,
            type: 're-export-namespace',
            items: [{ name: '*', type: 're-export-namespace', exportedAs: name }]
          });
          
          exports.push({
            name: name,
            type: 'namespace',
            reExportFrom: modulePath,
            declared: false
          });
        }
      }
    }
  }
  
  return { imports, exports };
}

// 扫描源文件
async function scanSourceFiles(projectDir, options) {
  const files = [];
  const includePatterns = ['*.vue', '*.js', '*.jsx'];
  
  if (options.include) {
    includePatterns.push(...options.include.split(',').map(p => p.trim()));
  }
  
  const excludePatterns = options.exclude ? options.exclude.split(',').map(p => p.trim()) : [];
  excludePatterns.push('node_modules/**', 'dist/**', 'build/**');
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(projectDir, fullPath);
      
      // 检查是否应该排除
      if (shouldExcludeFile(relativePath, excludePatterns.join(','))) {
        continue;
      }
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        // 检查是否匹配包含模式
        const ext = path.extname(item);
        const shouldInclude = includePatterns.some(pattern => {
          if (pattern.startsWith('*.')) {
            return ext === pattern.substring(1);
          }
          return item.includes(pattern);
        });
        
        if (shouldInclude) {
          files.push({
            path: fullPath,
            relativePath: relativePath,
            name: item,
            extension: ext
          });
        }
      }
    }
  }
  
  scanDirectory(projectDir);
  return files;
}

module.exports = {
  isNodeModule,
  analyzeFileContent,
  scanSourceFiles
};