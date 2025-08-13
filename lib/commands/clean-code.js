const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseProjectConfig } = require('../utils/project-config');
const { scanSourceFiles, analyzeFileContent, isNodeModule } = require('../utils/file-analyzer');
const { analyzeDependencies, resolveImportPath, resolveRequireContext } = require('../utils/dependency-analyzer');
const { analyzeRouterUsage } = require('../utils/router-analyzer');

// 主要的代码清理功能
async function cleanDeadCode(options) {
  const projectDir = path.resolve(options.dir);
  
  // 验证项目目录
  if (!fs.existsSync(projectDir)) {
    throw new Error(`项目目录不存在: ${projectDir}`);
  }
  
  if (!fs.existsSync(path.join(projectDir, 'package.json'))) {
    throw new Error('目录中没有找到package.json文件，请确保这是一个Node.js项目');
  }
  
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  
  // 解析项目配置
  console.log('🔧 解析项目配置...');
  const projectConfig = await parseProjectConfig(projectDir, packageJson);
  console.log(`📋 项目类型: ${projectConfig.type}`);
  if (Object.keys(projectConfig.alias).length > 0) {
    console.log(`🔗 发现 ${Object.keys(projectConfig.alias).length} 个路径别名`);
  }
  
  console.log(`🔍 开始分析项目: ${projectDir}`);
  
  // 扫描所有相关文件
  const files = await scanSourceFiles(projectDir, options);
  console.log(`📁 找到 ${files.length} 个源文件`);
  
  // 处理自定义入口文件
  let customEntryFiles = null;
  if (options.entry) {
    customEntryFiles = options.entry.split(',').map(entry => entry.trim());
    console.log(`🎯 额外入口文件: ${customEntryFiles.join(', ')}`);
    console.log('🎯 同时使用默认入口文件检测规则');
    
    // 验证自定义入口文件是否存在
    for (const entryFile of customEntryFiles) {
      const entryPath = path.resolve(projectDir, entryFile);
      if (!fs.existsSync(entryPath)) {
        throw new Error(`额外入口文件不存在: ${entryFile}`);
      }
    }
  } else {
    console.log('🎯 使用默认入口文件检测规则');
  }
  
  // 分析依赖关系
  console.log('🔗 分析文件依赖关系...');
  const dependencyGraph = await analyzeDependencies(files, projectDir, projectConfig, customEntryFiles);
  
  // 分析路由使用情况
  console.log('🛣️  分析路由使用情况...');
  let routerAnalysis;
  try {
    routerAnalysis = analyzeRouterUsage(files, projectDir, projectConfig, customEntryFiles);
    console.log(`🛣️  路由分析结果: 定义${routerAnalysis.routeDefinitions.length}个路由, 使用${routerAnalysis.routeUsages.length}个, 未使用${routerAnalysis.unusedRoutes.length}个`);
  } catch (error) {
    console.error('❌ 路由分析出错:', error.message);
    routerAnalysis = { routeDefinitions: [], routeUsages: [], unusedRoutes: [] };
  }
  
  // 检测死代码
  console.log('🔍 检测未使用的代码...');
  let deadCode;
  try {
    deadCode = detectDeadCode(dependencyGraph, projectDir, projectConfig);
  } catch (error) {
    console.error('❌ 死代码检测过程中出现错误:', error.message);
    console.log('💡 这可能是由于复杂的循环依赖导致的。请检查项目中是否存在循环引用。');
    throw error;
  }
  
  if (deadCode.files.length === 0 && deadCode.exports.length === 0 && routerAnalysis.unusedRoutes.length === 0) {
    console.log('✅ 没有发现死代码，项目代码很干净！');
    return;
  }
  
  // 显示分析结果
  displayAnalysisResults(deadCode, routerAnalysis);
  
  // 调试模式输出
  if (options.debug) {
    console.log('\n' + '='.repeat(80));
    console.log('🐛 调试信息');
    console.log('='.repeat(80));
    
    console.log(`\n📈 统计详情:`);
    console.log(`   扫描的文件总数: ${files.length}`);
    console.log(`   分析的依赖图节点: ${dependencyGraph.files.size}`);
    console.log(`   入口文件数量: ${Array.from(dependencyGraph.files.values()).filter(f => f.isEntry).length}`);
    
    console.log(`\n🔗 别名配置:`);
    if (Object.keys(projectConfig.alias).length === 0) {
      console.log('   无别名配置');
    } else {
      Object.entries(projectConfig.alias).forEach(([key, value]) => {
        console.log(`   ${key} -> ${path.relative(projectDir, value)}`);
      });
    }
    
    console.log(`\n📂 扩展名配置:`);
    console.log(`   ${projectConfig.extensions.join(', ')}`);
    
    if (deadCode.files.length > 0) {
      console.log(`\n❌ 死文件详情:`);
      deadCode.files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.relativePath}`);
        
        // 显示这个文件有没有被任何文件尝试导入过
        let attemptedImports = 0;
        for (const [filePath, fileInfo] of dependencyGraph.files) {
          for (const imp of fileInfo.imports) {
            if (imp.from.includes(file.relativePath.replace(/\\/g, '/')) || 
                imp.from.includes(path.basename(file.relativePath, path.extname(file.relativePath)))) {
              attemptedImports++;
            }
          }
        }
        
        if (attemptedImports > 0) {
          console.log(`      ⚠️ 发现 ${attemptedImports} 个可能的导入尝试`);
        }
      });
    }
  }
  
  // 调试特定文件 - 已移至专门的debug-file工具
  if (options.debugFile) {
    console.log('\n💡 提示: 请使用专门的debug-file工具来调试特定文件:');
    console.log(`   node bin/cli-new.js debug-file -d "${projectDir}" -f "${options.debugFile}" -r "引用文件路径"`);
  }
  
  if (options.dryRun) {
    console.log('\n💡 这是预览模式，没有实际删除任何文件');
    return;
  }
  
  // 确认删除
  if (!await confirmDeletion(deadCode)) {
    console.log('❌ 用户取消操作');
    return;
  }
  
  // 创建备份
  let backupDir = null;
  if (options.backup) {
    backupDir = await createBackup(projectDir, deadCode);
    console.log(`💾 备份已创建: ${backupDir}`);
  }
  
  try {
    // 执行清理
    await performCleanup(deadCode, projectDir);
    
    // 测试验证
    if (!options.skipTest) {
      console.log('\n🧪 运行测试验证...');
      const testResult = await runDevTest(projectDir);
      
      if (!testResult.success) {
        console.log('❌ 测试失败，正在恢复文件...');
        if (backupDir) {
          await restoreFromBackup(backupDir, projectDir);
          console.log('✅ 文件已恢复');
        }
        throw new Error(`测试失败: ${testResult.error}`);
      }
      
      console.log('✅ 测试通过！');
    }
    
    console.log('\n🎉 代码清理完成！');
    if (backupDir) {
      console.log(`💾 备份文件保存在: ${backupDir}`);
      console.log('💡 如需恢复，请手动复制备份文件');
    }
    
  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error.message);
    if (backupDir) {
      console.log('正在从备份恢复...');
      await restoreFromBackup(backupDir, projectDir);
      console.log('✅ 文件已恢复');
    }
    throw error;
  }
}

// 检测死代码
function detectDeadCode(graph, projectDir, projectConfig) {
  const usedFiles = new Set();
  const usedExports = new Map(); // filePath -> Set of used export names
  const deadFiles = [];
  const deadExports = [];
  
  // 使用队列避免栈溢出的标记函数
  function markAsUsed(startPath, requiredExports = null) {
    const queue = [{ filePath: startPath, exports: requiredExports }];
    const visited = new Set(); // 防止循环依赖
    
    while (queue.length > 0) {
      const { filePath, exports: currentExports } = queue.shift();
      
      // 创建唯一的访问键，包含文件路径和导出信息
      const visitKey = `${filePath}:${Array.isArray(currentExports) ? currentExports.join(',') : currentExports || '*'}`;
      if (visited.has(visitKey)) {
        continue; // 已经处理过这个文件和导出组合
      }
      visited.add(visitKey);
      
      const fileInfo = graph.files.get(filePath);
      if (!fileInfo) continue;
      
      // 标记文件为已使用
      usedFiles.add(filePath);
      
      // 记录使用的导出
      if (currentExports) {
        if (!usedExports.has(filePath)) {
          usedExports.set(filePath, new Set());
        }
        const exportSet = usedExports.get(filePath);
        
        if (Array.isArray(currentExports)) {
          currentExports.forEach(exp => exportSet.add(exp));
        } else {
          exportSet.add(currentExports);
        }
      } else {
        // 如果没有指定具体导出，标记整个文件被使用
        if (!usedExports.has(filePath)) {
          usedExports.set(filePath, new Set(['*']));
        } else {
          usedExports.get(filePath).add('*');
        }
      }
      
      // 将这个文件导入的所有文件加入队列
      for (const imp of fileInfo.imports) {
        let resolvedPaths;
        
        // 处理require.context的特殊情况
        if (imp.type === 'require-context') {
          resolvedPaths = resolveRequireContext(imp, filePath, projectDir, projectConfig);
        } else {
          resolvedPaths = resolveImportPath(imp.from, filePath, projectDir, projectConfig);
        }
        
        // 处理单个路径或路径数组
        const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
        
        for (const resolvedPath of pathArray) {
          if (resolvedPath && graph.files.has(resolvedPath)) {
            // 确定需要哪些导出
            const neededExports = imp.items ? imp.items.map(item => {
              if (item.type === 'default') return 'default';
              if (item.type === 'namespace' || item.name === '*') return '*';
              return item.name;
            }) : ['*'];
            
            // 检查是否已经处理过这个组合
            const nextVisitKey = `${resolvedPath}:${neededExports.join(',')}`;
            if (!visited.has(nextVisitKey)) {
              queue.push({ filePath: resolvedPath, exports: neededExports });
            }
          }
        }
      }
    }
  }
  
  // 从所有入口文件开始
  for (const [filePath, fileInfo] of graph.files) {
    if (fileInfo.isEntry) {
      markAsUsed(filePath);
    }
  }
  
  // 找出未使用的文件
  for (const [filePath, fileInfo] of graph.files) {
    if (!usedFiles.has(filePath) && !fileInfo.isEntry) {
      deadFiles.push({
        path: filePath,
        relativePath: fileInfo.relativePath
      });
    }
  }
  
  // 找出未使用的导出（文件被使用但某些导出未使用）
  for (const [filePath, fileInfo] of graph.files) {
    if (usedFiles.has(filePath) && !fileInfo.isEntry) {
      const usedExportSet = usedExports.get(filePath) || new Set();
      
      // 如果整个文件被标记为使用（通过 * 或动态导入），跳过导出级别检查
      if (usedExportSet.has('*')) {
        continue;
      }
      
      // 检查每个导出是否被使用
      for (const exportInfo of fileInfo.exports) {
        const isUsed = usedExportSet.has(exportInfo.name) || 
                      usedExportSet.has('default') && exportInfo.type === 'default';
        
        if (!isUsed) {
          deadExports.push({
            name: exportInfo.name,
            type: exportInfo.type,
            file: fileInfo.relativePath,
            filePath: filePath
          });
        }
      }
    }
  }
  
  return {
    files: deadFiles,
    exports: deadExports,
    usedFiles: usedFiles.size,
    totalFiles: graph.files.size
  };
}

// 显示分析结果
function displayAnalysisResults(deadCode, routerAnalysis) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 死代码分析结果');
  console.log('='.repeat(80));
  
  if (deadCode.files.length > 0) {
    console.log(`\n❌ 发现 ${deadCode.files.length} 个未使用的文件:`);
    deadCode.files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.relativePath}`);
    });
  }
  
  if (deadCode.exports.length > 0) {
    console.log(`\n⚠️  发现 ${deadCode.exports.length} 个未使用的导出:`);
    
    // 按文件分组显示
    const exportsByFile = {};
    deadCode.exports.forEach(exp => {
      if (!exportsByFile[exp.file]) {
        exportsByFile[exp.file] = [];
      }
      exportsByFile[exp.file].push(exp);
    });
    
    Object.entries(exportsByFile).forEach(([file, exports]) => {
      console.log(`\n   📄 ${file}:`);
      exports.forEach(exp => {
        const typeIcon = exp.type === 'default' ? '🔹' : '🔸';
        console.log(`      ${typeIcon} ${exp.name} (${exp.type})`);
      });
    });
  }
  
  // 显示未使用的路由
  if (routerAnalysis && routerAnalysis.unusedRoutes && routerAnalysis.unusedRoutes.length > 0) {
    console.log(`\n🛣️  发现 ${routerAnalysis.unusedRoutes.length} 个未使用的路由:`);
    routerAnalysis.unusedRoutes.forEach((route, index) => {
      console.log(`   ${index + 1}. ${route.path}${route.name ? ` (${route.name})` : ''}`);
      console.log(`      📄 定义在: ${route.file}:${route.line}`);
    });
  }
  
  console.log(`\n📈 统计信息:`);
  console.log(`   ✅ 使用的文件: ${deadCode.usedFiles}`);
  console.log(`   ❌ 死文件: ${deadCode.files.length}`);
  console.log(`   📁 总文件数: ${deadCode.totalFiles}`);
  console.log(`   🔸 死导出: ${deadCode.exports.length}`);
  if (routerAnalysis) {
    console.log(`   🛣️  总路由数: ${routerAnalysis.routeDefinitions.length}`);
    console.log(`   🚫 未使用路由: ${routerAnalysis.unusedRoutes.length}`);
  }
}

// 确认删除对话
async function confirmDeletion(deadCode) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    console.log(`\n⚠️  准备删除 ${deadCode.files.length} 个文件。`);
    readline.question('确认执行删除操作吗？(y/N): ', answer => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// 创建备份
async function createBackup(projectDir, deadCode) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(projectDir, `backup-${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  for (const file of deadCode.files) {
    const relativePath = file.relativePath;
    const backupPath = path.join(backupDir, relativePath);
    const backupDirPath = path.dirname(backupPath);
    
    if (!fs.existsSync(backupDirPath)) {
      fs.mkdirSync(backupDirPath, { recursive: true });
    }
    
    fs.copyFileSync(file.path, backupPath);
  }
  
  return backupDir;
}

// 执行清理
async function performCleanup(deadCode, projectDir) {
  console.log('\n🗑️  删除文件...');
  
  for (const file of deadCode.files) {
    try {
      fs.unlinkSync(file.path);
      console.log(`   ✅ 删除: ${file.relativePath}`);
    } catch (error) {
      console.log(`   ❌ 删除失败: ${file.relativePath} - ${error.message}`);
    }
  }
  
  console.log(`\n✅ 删除完成，共删除 ${deadCode.files.length} 个文件`);
}

// 运行开发测试
async function runDevTest(projectDir) {
  try {
    console.log('   运行 npm run dev 测试...');
    
    // 设置超时为30秒
    const result = execSync('npm run dev --', { 
      cwd: projectDir, 
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8'
    });
    
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

// 从备份恢复
async function restoreFromBackup(backupDir, projectDir) {
  console.log('\n🔄 从备份恢复文件...');
  
  function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      const items = fs.readdirSync(src);
      for (const item of items) {
        copyRecursive(path.join(src, item), path.join(dest, item));
      }
    } else {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(src, dest);
      console.log(`   ✅ 恢复: ${path.relative(projectDir, dest)}`);
    }
  }
  
  copyRecursive(backupDir, projectDir);
}

module.exports = {
  cleanDeadCode
};