const fs = require('fs');
const path = require('path');

// 检查文件是否应该被排除
function shouldExcludeFile(fileName, excludePatterns) {
  if (!excludePatterns || !fileName) return false;
  
  const patterns = excludePatterns.split(',').map(p => p.trim());
  
  for (const pattern of patterns) {
    // 简单的通配符匹配
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(fileName)) {
        return true;
      }
    } else {
      // 精确匹配或包含匹配
      if (fileName === pattern || fileName.includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

// 获取文件扩展名
function getFileExtension(fileName) {
  if (!fileName || fileName.startsWith('.')) {
    return fileName || '无扩展名';
  }
  
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) {
    return '无扩展名';
  }
  
  const extension = fileName.substring(lastDot);
  
  // 特殊文件名处理
  const specialFiles = {
    'package.json': '.json',
    'package-lock.json': '.json',
    'yarn.lock': 'lock文件',
    'Dockerfile': 'Dockerfile',
    'Makefile': 'Makefile',
    'README.md': '.md',
    '.gitignore': 'git配置',
    '.env': '环境配置'
  };
  
  return specialFiles[fileName] || extension || '无扩展名';
}

// 绘制横向柱状图
function drawHorizontalBarChart(value, maxValue, barWidth = 50) {
  if (maxValue === 0) return '';
  
  const filledLength = Math.round((value / maxValue) * barWidth);
  const emptyLength = barWidth - filledLength;
  
  const filledBar = '█'.repeat(filledLength);
  const emptyBar = '░'.repeat(emptyLength);
  
  return filledBar + emptyBar;
}

module.exports = {
  shouldExcludeFile,
  getFileExtension,
  drawHorizontalBarChart
};