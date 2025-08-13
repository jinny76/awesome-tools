const fs = require('fs');
const path = require('path');

// 解析项目配置(Vue CLI/Vite)
async function parseProjectConfig(projectDir, packageJson) {
  const config = {
    type: 'unknown',
    alias: {},
    extensions: ['.vue', '.js', '.jsx', '.ts', '.tsx', '.json'],
    baseUrl: '.',
    srcDir: 'src'
  };
  
  // 检测项目类型
  const isVite = !!(packageJson.dependencies?.vite || packageJson.devDependencies?.vite);
  const isVueCLI = !!(packageJson.dependencies?.['@vue/cli-service'] || 
                     packageJson.devDependencies?.['@vue/cli-service']);
  
  if (isVite) {
    config.type = 'Vite';
    await parseViteConfig(projectDir, config);
  } else if (isVueCLI) {
    config.type = 'Vue CLI';
    await parseVueConfig(projectDir, config);
  } else {
    config.type = 'Generic Vue/JS';
    // 设置默认的alias
    config.alias['@'] = path.join(projectDir, 'src');
  }
  
  return config;
}

// 解析Vite配置
async function parseViteConfig(projectDir, config) {
  const configFiles = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];
  
  for (const configFile of configFiles) {
    const configPath = path.join(projectDir, configFile);
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // 解析alias配置
        const aliasRegex = /alias\s*:\s*{([^}]*)}/s;
        const aliasMatch = configContent.match(aliasRegex);
        if (aliasMatch) {
          const aliasContent = aliasMatch[1];
          
          // 匹配各种alias模式
          const aliasPatterns = [
            // '@': path.resolve(__dirname, 'src')
            /'([^']+)'\s*:\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g,
            // '@': './src'
            /'([^']+)'\s*:\s*['"']([^'"]+)['"']/g,
            // "@": path.resolve(__dirname, "src")  
            /"([^"]+)"\s*:\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g,
            // "@": "./src"
            /"([^"]+)"\s*:\s*['"']([^'"]+)['"']/g
          ];
          
          for (const pattern of aliasPatterns) {
            let match;
            while ((match = pattern.exec(aliasContent)) !== null) {
              const aliasKey = match[1];
              let aliasPath = match[2];
              
              // 处理相对路径
              if (aliasPath.startsWith('./') || aliasPath.startsWith('../')) {
                aliasPath = path.resolve(projectDir, aliasPath);
              } else if (!path.isAbsolute(aliasPath)) {
                aliasPath = path.resolve(projectDir, aliasPath);
              }
              
              config.alias[aliasKey] = aliasPath;
            }
          }
        }
        
        // 解析extensions
        const extensionsRegex = /extensions\s*:\s*\[([^\]]*)\]/;
        const extensionsMatch = configContent.match(extensionsRegex);
        if (extensionsMatch) {
          const extensionsContent = extensionsMatch[1];
          const extensions = extensionsContent.match(/['"']([^'"]+)['"']/g);
          if (extensions) {
            config.extensions = extensions.map(ext => ext.replace(/['"]/g, ''));
          }
        }
        
        break;
      } catch (error) {
        console.log(`⚠️  解析${configFile}失败: ${error.message}`);
      }
    }
  }
  
  // 如果没有找到@别名，设置默认值
  if (!config.alias['@']) {
    config.alias['@'] = path.join(projectDir, 'src');
  }
}

// 解析Vue CLI配置
async function parseVueConfig(projectDir, config) {
  const configPath = path.join(projectDir, 'vue.config.js');
  
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // 解析chainWebpack中的alias配置
      const chainWebpackRegex = /chainWebpack\s*:\s*config\s*=>\s*{([^}]*)}/s;
      const chainMatch = configContent.match(chainWebpackRegex);
      if (chainMatch) {
        const chainContent = chainMatch[1];
        
        // config.resolve.alias.set('@', path.resolve(__dirname, 'src'))
        const aliasSetRegex = /config\.resolve\.alias\.set\s*\(\s*['"']([^'"]+)['"']\s*,\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g;
        let match;
        while ((match = aliasSetRegex.exec(chainContent)) !== null) {
          const aliasKey = match[1];
          const aliasPath = path.resolve(projectDir, match[2]);
          config.alias[aliasKey] = aliasPath;
        }
      }
      
      // 解析configureWebpack中的alias
      const configureWebpackRegex = /configureWebpack\s*:\s*{([^}]*)}/s;
      const configureMatch = configContent.match(configureWebpackRegex);
      if (configureMatch) {
        const configureContent = configureMatch[1];
        
        const resolveRegex = /resolve\s*:\s*{([^}]*)}/s;
        const resolveMatch = configureContent.match(resolveRegex);
        if (resolveMatch) {
          const resolveContent = resolveMatch[1];
          
          const aliasRegex = /alias\s*:\s*{([^}]*)}/s;
          const aliasMatch = resolveContent.match(aliasRegex);
          if (aliasMatch) {
            const aliasContent = aliasMatch[1];
            
            // '@': path.resolve(__dirname, 'src')
            const aliasItemRegex = /['"']([^'"]+)['"']\s*:\s*path\.resolve\([^,)]*,\s*['"']([^'"]+)['"']\)/g;
            let match;
            while ((match = aliasItemRegex.exec(aliasContent)) !== null) {
              const aliasKey = match[1];
              const aliasPath = path.resolve(projectDir, match[2]);
              config.alias[aliasKey] = aliasPath;
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️  解析vue.config.js失败: ${error.message}`);
    }
  }
  
  // 如果没有找到@别名，设置默认值
  if (!config.alias['@']) {
    config.alias['@'] = path.join(projectDir, 'src');
  }
}

module.exports = {
  parseProjectConfig
};