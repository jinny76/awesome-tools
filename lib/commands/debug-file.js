const fs = require('fs');
const path = require('path');
const { parseProjectConfig } = require('../utils/project-config');
const { scanSourceFiles } = require('../utils/file-analyzer');
const { analyzeDependencies, resolveImportPath } = require('../utils/dependency-analyzer');

// 调试文件引用关系，质疑为什么目标文件被标记为死代码
async function debugFileUsage(options) {
  const projectDir = path.resolve(options.dir);
  const targetFile = path.resolve(projectDir, options.file);
  const refFile = path.resolve(projectDir, options.ref);
  
  // 验证文件存在
  if (!fs.existsSync(targetFile)) {
    throw new Error(`目标文件不存在: ${options.file}`);
  }
  
  if (!fs.existsSync(refFile)) {
    throw new Error(`引用文件不存在: ${options.ref}`);
  }
  
  console.log('🔍 质疑分析: 为什么目标文件被标记为死代码？');
  console.log('='.repeat(80));
  console.log(`📄 目标文件: ${options.file}`);
  console.log(`📄 声称引用文件: ${options.ref}`);
  console.log(`📁 项目目录: ${projectDir}`);
  
  // 解析项目配置
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  const projectConfig = await parseProjectConfig(projectDir, packageJson);
  console.log(`📋 项目类型: ${projectConfig.type}`);
  
  // 显示别名配置
  if (Object.keys(projectConfig.alias).length > 0) {
    console.log('\n🔗 路径别名配置:');
    Object.entries(projectConfig.alias).forEach(([key, value]) => {
      console.log(`   ${key} -> ${path.relative(projectDir, value)}`);
    });
  }
  
  // 扫描所有文件
  console.log('\n📂 扫描项目文件...');
  const files = await scanSourceFiles(projectDir, options);
  console.log(`📁 找到 ${files.length} 个源文件`);
  
  // 检查文件是否在扫描范围内
  const targetFileInfo = files.find(f => f.path === targetFile);
  const refFileInfo = files.find(f => f.path === refFile);
  
  if (!targetFileInfo) {
    console.log(`❌ 目标文件不在扫描范围内: ${options.file}`);
    console.log('💡 可能被排除模式过滤，尝试调整 --include 或 --exclude 选项');
    return;
  }
  
  if (!refFileInfo) {
    console.log(`❌ 引用文件不在扫描范围内: ${options.ref}`);
    console.log('💡 可能被排除模式过滤，尝试调整 --include 或 --exclude 选项');
    return;
  }
  
  // 分析依赖关系
  console.log('\n🔗 分析文件依赖关系...');
  const dependencyGraph = await analyzeDependencies(files, projectDir, projectConfig);
  
  // 详细分析引用文件的导入
  console.log('\n' + '='.repeat(80));
  console.log(`📄 分析引用文件: ${refFileInfo.relativePath}`);
  console.log('='.repeat(80));
  
  const refFileData = dependencyGraph.files.get(refFile);
  
  console.log(`\n📥 引用文件的所有导入 (${refFileData.imports.length} 个):`);
  if (refFileData.imports.length === 0) {
    console.log('   🔸 该文件没有任何导入');
  } else {
    let foundTargetImport = false;
    
    refFileData.imports.forEach((imp, index) => {
      console.log(`\n   ${index + 1}. "${imp.from}" (${imp.type})`);
      
      // 尝试解析这个导入路径
      const resolvedPaths = resolveImportPath(imp.from, refFile, projectDir, projectConfig);
      const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
      
      console.log(`      🔄 路径解析:`);
      if (pathArray.length === 0) {
        console.log(`      ❌ 无法解析路径 "${imp.from}"`);
      } else {
        pathArray.forEach(resolvedPath => {
          const relativeResolved = path.relative(projectDir, resolvedPath);
          console.log(`      ✅ 解析到: ${relativeResolved}`);
          
          // 检查是否指向目标文件
          if (resolvedPath === targetFile) {
            foundTargetImport = true;
            console.log(`      🎯 *** 这个导入指向目标文件！***`);
          }
        });
      }
      
      // 显示导入的具体项
      if (imp.items && imp.items.length > 0) {
        console.log(`      📎 导入项:`);
        imp.items.forEach(item => {
          console.log(`         - ${item.name} (${item.type})`);
        });
      }
      
      // 手动检查路径相似性
      const targetRelative = path.relative(projectDir, targetFile);
      if (!foundTargetImport && isPathSimilar(imp.from, targetRelative, projectConfig)) {
        console.log(`      ⚠️  路径相似但未匹配: ${imp.from} vs ${targetRelative}`);
        console.log(`      💡 可能的原因:`);
        console.log(`         - 扩展名问题`);
        console.log(`         - 别名解析问题`);
        console.log(`         - 大小写敏感问题`);
      }
    });
    
    // 总结
    console.log(`\n📊 分析结果:`);
    if (foundTargetImport) {
      console.log(`   ✅ 确实找到了对目标文件的导入！`);
      console.log(`   🤔 如果目标文件仍被标记为死代码，可能的原因:`);
      console.log(`      1. 引用文件本身也是死代码`);
      console.log(`      2. 引用文件没有被入口文件引用`);
      console.log(`      3. 存在循环依赖导致分析错误`);
    } else {
      console.log(`   ❌ 在引用文件中没有找到对目标文件的有效导入`);
      console.log(`   💡 可能的问题:`);
      console.log(`      1. 导入路径写错了`);
      console.log(`      2. 别名配置不正确`);
      console.log(`      3. 文件扩展名问题`);
      console.log(`      4. 路径大小写问题`);
    }
  }
  
  // 分析目标文件
  console.log('\n' + '='.repeat(80));
  console.log(`📄 分析目标文件: ${targetFileInfo.relativePath}`);
  console.log('='.repeat(80));
  
  const targetFileData = dependencyGraph.files.get(targetFile);
  
  console.log(`\n📊 目标文件信息:`);
  console.log(`   是否入口文件: ${targetFileData.isEntry ? '是' : '否'}`);
  console.log(`   导出数量: ${targetFileData.exports.length}`);
  
  // 显示导出
  if (targetFileData.exports.length > 0) {
    console.log(`\n📤 目标文件的导出:`);
    targetFileData.exports.forEach((exp, index) => {
      const typeIcon = exp.type === 'default' ? '🔹' : '🔸';
      console.log(`   ${typeIcon} ${exp.name} (${exp.type})`);
    });
  }
  
  // 检查引用文件是否也被使用
  console.log(`\n🔍 检查引用文件的使用情况:`);
  let refFileUsed = false;
  let refFileReferences = [];
  
  for (const [filePath, file] of dependencyGraph.files) {
    if (filePath === refFile) continue;
    
    for (const imp of file.imports) {
      const resolvedPaths = resolveImportPath(imp.from, filePath, projectDir, projectConfig);
      const pathArray = Array.isArray(resolvedPaths) ? resolvedPaths : (resolvedPaths ? [resolvedPaths] : []);
      
      if (pathArray.includes(refFile)) {
        refFileUsed = true;
        refFileReferences.push({
          file: file.relativePath,
          import: imp.from
        });
      }
    }
  }
  
  if (refFileUsed) {
    console.log(`   ✅ 引用文件被使用 (${refFileReferences.length} 个引用)`);
    refFileReferences.forEach(ref => {
      console.log(`      📎 ${ref.file} -> ${ref.import}`);
    });
  } else if (refFileData.isEntry) {
    console.log(`   ✅ 引用文件是入口文件`);
  } else {
    console.log(`   ❌ 引用文件本身也没有被使用！`);
    console.log(`   💡 这就是目标文件被标记为死代码的原因！`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 结论和建议:');
  console.log('='.repeat(80));
  
  // 给出具体的建议
  if (!refFileUsed && !refFileData.isEntry) {
    console.log('❌ 引用文件本身就是死代码，所以目标文件也被标记为死代码');
    console.log('💡 建议: 检查引用文件的引用链，或将其设为入口文件');
  } else {
    console.log('✅ 引用文件是活跃的，目标文件理论上不应该是死代码');
    console.log('💡 建议: 检查路径解析配置，可能存在别名或扩展名问题');
  }
}

// 检查路径相似性的辅助函数
function isPathSimilar(importPath, targetPath, projectConfig) {
  // 移除扩展名比较
  const importWithoutExt = importPath.replace(/\.(js|ts|vue|jsx|tsx)$/, '');
  const targetWithoutExt = targetPath.replace(/\.(js|ts|vue|jsx|tsx)$/, '');
  
  // 标准化路径分隔符
  const normalizedImport = importWithoutExt.replace(/\\/g, '/');
  const normalizedTarget = targetWithoutExt.replace(/\\/g, '/');
  
  // 检查是否相似（去掉前缀路径）
  if (normalizedImport.includes(normalizedTarget) || normalizedTarget.includes(normalizedImport)) {
    return true;
  }
  
  // 检查别名情况
  for (const alias of Object.keys(projectConfig.alias)) {
    if (normalizedImport.startsWith(alias)) {
      const withoutAlias = normalizedImport.substring(alias.length);
      if (normalizedTarget.includes(withoutAlias)) {
        return true;
      }
    }
  }
  
  return false;
}

module.exports = {
  debugFileUsage
};