const fs = require('fs');
const path = require('path');
const { analyzeFileContent, isNodeModule } = require('./file-analyzer');

// 分析依赖关系
async function analyzeDependencies(files, projectDir, projectConfig, customEntryFiles = null) {
  const graph = {
    files: new Map(),
    imports: new Map(),
    exports: new Map()
  };
  
  // 解析自定义入口文件为绝对路径
  let customEntryPaths = null;
  if (customEntryFiles && customEntryFiles.length > 0) {
    customEntryPaths = customEntryFiles.map(entryFile => {
      return path.resolve(projectDir, entryFile);
    });
  }
  
  for (const file of files) {
    const content = fs.readFileSync(file.path, 'utf8');
    const analysis = analyzeFileContent(content, file);
    
    graph.files.set(file.path, {
      ...file,
      imports: analysis.imports,
      exports: analysis.exports,
      isEntry: isEntryFile(file, projectDir, customEntryPaths)
    });
    
    // 记录导入关系，使用配置解析路径
    for (const imp of analysis.imports) {
      const resolvedPaths = resolveImportPath(imp.from, file.path, projectDir, projectConfig);
      
      // 处理单个路径或路径数组
      const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
      
      for (const resolvedPath of pathArray) {
        if (resolvedPath) {
          if (!graph.imports.has(resolvedPath)) {
            graph.imports.set(resolvedPath, new Set());
          }
          graph.imports.get(resolvedPath).add(file.path);
        }
      }
    }
    
    // 记录导出
    for (const exp of analysis.exports) {
      if (!graph.exports.has(file.path)) {
        graph.exports.set(file.path, new Set());
      }
      graph.exports.get(file.path).add(exp);
    }
  }
  
  return graph;
}

// 检查是否为入口文件
function isEntryFile(file, projectDir, customEntryPaths = null) {
  // 检查是否为自定义入口文件
  if (customEntryPaths && customEntryPaths.length > 0 && customEntryPaths.includes(file.path)) {
    return true;
  }
  
  // 继续检查默认入口文件规则
  const entryPatterns = [
    'main.js', 'main.ts', 'index.js', 'index.ts',
    'App.vue', 'app.vue',
    'vite.config.js', 'vite.config.ts', 'vue.config.js'
  ];
  
  // 直接的入口文件
  if (entryPatterns.includes(file.name)) {
    return true;
  }
  
  // 路径模式匹配
  const pathPatterns = [
    /src[/\\]main\./,          // src/main.js, src/main.ts
    /src[/\\]index\./,         // src/index.js, src/index.ts  
    /src[/\\]App\./,           // src/App.vue
    /src[/\\]app\./,           // src/app.vue
    /router[/\\]index\./,      // router/index.js - 路由配置
    /store[/\\]index\./,       // store/index.js - 状态管理
    /plugins[/\\]/,            // plugins/ - Vue插件目录
    /utils[/\\]request\./,     // utils/request.js - 网络请求
    /utils[/\\]auth\./,        // utils/auth.js - 认证相关
    /assets[/\\].*\.(css|scss|less|stylus)$/,  // 样式文件
    /public[/\\]/,             // public目录下的文件
    /tests?[/\\].*\.(test|spec)\./,  // 测试文件
  ];
  
  const relativePath = file.relativePath.replace(/\\/g, '/'); // 标准化路径分隔符
  
  // 检查路径模式
  if (pathPatterns.some(pattern => pattern.test(relativePath))) {
    return true;
  }
  
  // 检查特殊文件内容模式
  if (isSpecialConfigurationFile(file, projectDir)) {
    return true;
  }
  
  return false;
}

// 检查是否为特殊配置文件
function isSpecialConfigurationFile(file, projectDir) {
  // 根目录下的配置文件
  const configPatterns = [
    /^[^/\\]*\.config\.(js|ts|mjs)$/,  // 任何.config.js文件
    /^(babel|webpack|rollup|postcss)\./,  // 构建工具配置
    /^\.env/,                         // 环境变量文件
    /^tsconfig\./,                    // TypeScript配置
    /^jest\./,                        // Jest配置
    /^cypress\./,                     // Cypress配置
  ];
  
  const relativePath = file.relativePath.replace(/\\/g, '/');
  return configPatterns.some(pattern => pattern.test(relativePath));
}

// 解析导入路径
function resolveImportPath(importPath, fromFile, projectDir, projectConfig) {
  // 跳过npm包
  if (isNodeModule(importPath) && !Object.keys(projectConfig.alias).some(alias => importPath.startsWith(alias))) {
    return null;
  }
  
  // 防止自引用
  if (importPath === '.' || importPath === './') {
    return null;
  }
  
  // 处理模板字符串和通配符路径
  if (importPath.includes('*')) {
    return resolveWildcardPath(importPath, fromFile, projectDir, projectConfig);
  }
  
  let resolved;
  
  // 处理alias路径
  const aliasKey = Object.keys(projectConfig.alias).find(alias => 
    importPath === alias || importPath.startsWith(alias + '/')
  );
  
  if (aliasKey) {
    const aliasPath = projectConfig.alias[aliasKey];
    const remainingPath = importPath.substring(aliasKey.length);
    resolved = path.join(aliasPath, remainingPath);
  } else if (importPath.startsWith('.') || importPath.startsWith('/')) {
    // 相对路径或绝对路径
    const fromDir = path.dirname(fromFile);
    resolved = path.resolve(fromDir, importPath);
  } else {
    return null;
  }
  
  // 尝试解析文件
  const extensions = projectConfig.extensions || ['.js', '.ts', '.vue', '.jsx', '.tsx', '.json'];
  
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      // 防止解析到自身
      if (resolved === fromFile) {
        return null;
      }
      return resolved;
    }
    if (stat.isDirectory()) {
      // 尝试查找index文件
      const indexPatterns = ['index', 'index.js', 'index.ts', 'index.vue'];
      for (const indexPattern of indexPatterns) {
        const indexPath = path.join(resolved, indexPattern);
        if (fs.existsSync(indexPath) && indexPath !== fromFile) {
          return indexPath;
        }
      }
      
      // 尝试添加扩展名到index
      const indexFile = path.join(resolved, 'index');
      for (const ext of extensions) {
        const indexPath = indexFile + ext;
        if (fs.existsSync(indexPath) && indexPath !== fromFile) {
          return indexPath;
        }
      }
    }
  }
  
  // 尝试添加扩展名到文件
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt) && withExt !== fromFile) {
      return withExt;
    }
  }
  
  return null;
}

// 解析通配符路径
function resolveWildcardPath(wildcardPath, fromFile, projectDir, projectConfig) {
  const resolvedPaths = [];
  
  // 处理alias
  let basePath = wildcardPath;
  const aliasKey = Object.keys(projectConfig.alias).find(alias => 
    wildcardPath.startsWith(alias + '/')
  );
  
  if (aliasKey) {
    const aliasPath = projectConfig.alias[aliasKey];
    const remainingPath = wildcardPath.substring(aliasKey.length);
    basePath = path.join(aliasPath, remainingPath);
  } else if (wildcardPath.startsWith('.') || wildcardPath.startsWith('/')) {
    const fromDir = path.dirname(fromFile);
    basePath = path.resolve(fromDir, wildcardPath);
  }
  
  // 将通配符路径转换为目录搜索
  const pathParts = basePath.split('*');
  if (pathParts.length !== 2) {
    return resolvedPaths; // 暂时只支持一个*的情况
  }
  
  const beforeStar = pathParts[0];
  const afterStar = pathParts[1];
  
  // 找到搜索的基础目录
  const searchDir = path.dirname(beforeStar);
  const filePrefix = path.basename(beforeStar);
  
  if (!fs.existsSync(searchDir)) {
    return resolvedPaths;
  }
  
  try {
    const files = fs.readdirSync(searchDir);
    for (const file of files) {
      if (file.startsWith(filePrefix)) {
        const potentialPath = path.join(searchDir, file + afterStar);
        if (fs.existsSync(potentialPath)) {
          resolvedPaths.push(potentialPath);
        }
        
        // 也尝试不同扩展名
        const extensions = projectConfig.extensions || ['.js', '.ts', '.vue', '.jsx', '.tsx'];
        for (const ext of extensions) {
          const withExt = path.join(searchDir, file + afterStar + ext);
          if (fs.existsSync(withExt)) {
            resolvedPaths.push(withExt);
          }
        }
      }
    }
  } catch (error) {
    // 忽略读取目录错误
  }
  
  return resolvedPaths;
}

module.exports = {
  analyzeDependencies,
  isEntryFile,
  resolveImportPath
};