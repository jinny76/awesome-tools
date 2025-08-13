const fs = require('fs');
const path = require('path');

// 解析.gitignore文件
function parseGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const patterns = [];
  
  if (!fs.existsSync(gitignorePath)) {
    return patterns;
  }
  
  try {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n');
    
    for (let line of lines) {
      line = line.trim();
      
      // 跳过空行和注释
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // 处理否定模式（以!开头的）
      const isNegation = line.startsWith('!');
      if (isNegation) {
        line = line.substring(1);
        // TODO: 处理否定模式，暂时跳过
        continue;
      }
      
      patterns.push(line);
    }
  } catch (error) {
    console.warn(`⚠️  读取.gitignore文件失败: ${error.message}`);
  }
  
  return patterns;
}

// 检查路径是否应该被gitignore规则排除
function shouldExcludeByGitignore(relativePath, gitignorePatterns) {
  if (!gitignorePatterns || gitignorePatterns.length === 0) {
    return false;
  }
  
  // 标准化路径分隔符
  const normalizedPath = relativePath.replace(/\\/g, '/');
  
  for (const pattern of gitignorePatterns) {
    if (matchGitignorePattern(normalizedPath, pattern)) {
      return true;
    }
  }
  
  return false;
}

// gitignore模式匹配（基于minimatch算法的简化版）
function matchGitignorePattern(filePath, pattern) {
  // 如果模式以/开头，只匹配根目录
  if (pattern.startsWith('/')) {
    pattern = pattern.substring(1);
    return matchPattern(filePath, pattern);
  }
  
  // 否则可以匹配任何目录层级
  // 尝试直接匹配
  if (matchPattern(filePath, pattern)) {
    return true;
  }
  
  // 尝试在任何目录下匹配
  const pathParts = filePath.split('/');
  for (let i = 0; i < pathParts.length; i++) {
    const subPath = pathParts.slice(i).join('/');
    if (matchPattern(subPath, pattern)) {
      return true;
    }
  }
  
  return false;
}

// 简单的模式匹配
function matchPattern(str, pattern) {
  // 处理目录模式（以/结尾）
  if (pattern.endsWith('/')) {
    // 如果模式以/结尾，匹配目录及其所有内容
    const dirPattern = pattern.substring(0, pattern.length - 1);
    return str === dirPattern || str.startsWith(dirPattern + '/');
  }
  
  // 转换为正则表达式
  let regexPattern = pattern
    .replace(/\./g, '\\.')  // 转义点号
    .replace(/\*\*/g, '{{GLOBSTAR}}')  // 临时替换**
    .replace(/\*/g, '[^/]*')  // *匹配除/外的任意字符
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')  // **匹配任意字符包括/
    .replace(/\?/g, '[^/]');  // ?匹配除/外的单个字符
  
  try {
    const regex = new RegExp('^' + regexPattern + '$');
    return regex.test(str);
  } catch (error) {
    console.warn(`gitignore模式匹配错误: ${pattern} -> ${error.message}`);
    return false;
  }
}

module.exports = {
  parseGitignore,
  shouldExcludeByGitignore,
  matchGitignorePattern
};