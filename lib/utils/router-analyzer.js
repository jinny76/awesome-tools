const fs = require('fs');
const path = require('path');
const { analyzeFileContent } = require('./file-analyzer');

// 分析 Vue Router 使用情况
function analyzeRouterUsage(files, projectDir, projectConfig, customEntryFiles = null) {
  const routerAnalysis = {
    routeDefinitions: [],  // 定义的路由
    routeUsages: [],       // 使用的路由
    unusedRoutes: []       // 未使用的路由
  };

  // 1. 提取路由定义
  for (const file of files) {
    if (isRouterFile(file)) {
      const content = fs.readFileSync(file.path, 'utf8');
      const routes = extractRouteDefinitions(content, file);
      routerAnalysis.routeDefinitions.push(...routes);
    }
  }

  // 2. 查找路由使用
  for (const file of files) {
    const content = fs.readFileSync(file.path, 'utf8');
    const usages = extractRouteUsages(content, file);
    routerAnalysis.routeUsages.push(...usages);
  }

  // 3. 处理自定义入口文件中的路由定义
  if (customEntryFiles && customEntryFiles.length > 0) {
    const customEntryUsages = handleCustomEntryRoutes(
      customEntryFiles, 
      routerAnalysis.routeDefinitions, 
      projectDir
    );
    routerAnalysis.routeUsages.push(...customEntryUsages);
  }

  // 4. 找出未使用的路由
  routerAnalysis.unusedRoutes = findUnusedRoutes(
    routerAnalysis.routeDefinitions,
    routerAnalysis.routeUsages
  );

  return routerAnalysis;
}

// 判断是否为路由配置文件
function isRouterFile(file) {
  const routerPatterns = [
    /router[/\\]index\.(js|ts)$/,
    /router\.(js|ts)$/,
    /routes\.(js|ts)$/,
    /router[/\\]routes\.(js|ts)$/
  ];
  
  return routerPatterns.some(pattern => pattern.test(file.relativePath));
}

// 提取路由定义
function extractRouteDefinitions(content, file) {
  const routes = [];
  
  // 处理多行路由对象，首先清理注释和不相关内容
  const cleanContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  // 更强大的路由对象匹配 - 支持多行和复杂结构
  const routeObjectRegex = /\{\s*path\s*:\s*['"`]([^'"`]+)['"`][\s\S]*?\}/g;
  let match;
  
  while ((match = routeObjectRegex.exec(cleanContent)) !== null) {
    const routeObject = match[0];
    const routePath = match[1];
    
    // 提取路由名称
    const nameMatch = routeObject.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
    const routeName = nameMatch ? nameMatch[1] : null;
    
    routes.push({
      path: routePath,
      name: routeName,
      file: file.relativePath,
      line: getLineNumber(content, match.index)
    });
    
    // 查找子路由
    const childrenMatch = routeObject.match(/children\s*:\s*\[([\s\S]*)\]/);
    if (childrenMatch) {
      const childrenContent = childrenMatch[1];
      const childRoutes = extractRouteDefinitions(childrenContent, file);
      
      // 为子路由添加父路径前缀
      childRoutes.forEach(childRoute => {
        if (!childRoute.path.startsWith('/')) {
          childRoute.path = routePath + '/' + childRoute.path;
        }
      });
      
      routes.push(...childRoutes);
    }
  }

  return routes;
}

// 提取路由使用
function extractRouteUsages(content, file) {
  const usages = [];
  
  // Vue Router 使用模式
  const usagePatterns = [
    // router-link to="/path"
    { regex: /router-link[^>]+to\s*=\s*['"`]([^'"`]+)['"`]/g, type: 'path' },
    // router-link :to="{ name: 'routeName' }" - 支持多种格式
    { regex: /:to\s*=\s*['"`]\{\s*name\s*:\s*['"`]([^'"`]+)['"`]/g, type: 'name' },
    { regex: /:to\s*=\s*\{\s*name\s*:\s*['"`]([^'"`]+)['"`]/g, type: 'name' },
    // $router.push('/path')
    { regex: /\$router\.push\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'path' },
    // $router.push({ name: 'routeName' })
    { regex: /\$router\.push\s*\(\s*\{\s*name\s*:\s*['"`]([^'"`]+)['"`]/g, type: 'name' },
    // router.push('/path')
    { regex: /router\.push\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'path' },
    // router.push({ name: 'routeName' })
    { regex: /router\.push\s*\(\s*\{\s*name\s*:\s*['"`]([^'"`]+)['"`]/g, type: 'name' },
    // this.$router.replace, $router.go 等其他导航方法
    { regex: /\$router\.(replace|go)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'path' },
    // useRouter().push 等 Composition API
    { regex: /useRouter\(\)\.push\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, type: 'path' },
    
    // 动态路由拼接模式
    // 模板字符串: `/user/${userId}`
    { regex: /['"`]\/[^'"`]*\$\{[^}]+\}[^'"`]*['"`]/g, type: 'dynamic-template' },
    // 字符串拼接: '/user/' + userId
    { regex: /['"`]\/[^'"`]+['"`]\s*\+\s*[^;,)]+/g, type: 'dynamic-concat' },
    // 反向模板字符串拼接: `${basePath}/api`
    { regex: /\$\{[^}]+\}\/[^'"`]*['"`]/g, type: 'dynamic-template-reverse' }
  ];

  for (const pattern of usagePatterns) {
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      let routeReference = match[1] || match[2]; // 路径或名称
      let usageType = pattern.type;
      
      // 处理动态路由模式
      if (pattern.type.startsWith('dynamic-')) {
        const dynamicPatterns = extractDynamicRoutePatterns(match[0]);
        for (const dynamicPattern of dynamicPatterns) {
          usages.push({
            reference: dynamicPattern,
            type: 'dynamic-path',
            file: file.relativePath,
            line: getLineNumber(content, match.index),
            original: match[0]
          });
        }
      } else if (routeReference && routeReference.trim()) {
        usages.push({
          reference: routeReference,
          type: usageType,
          file: file.relativePath,
          line: getLineNumber(content, match.index)
        });
      }
    }
  }

  return usages;
}

// 找出未使用的路由
function findUnusedRoutes(definitions, usages) {
  const unusedRoutes = [];
  
  for (const route of definitions) {
    let isUsed = false;
    
    // 检查路径使用
    if (route.path) {
      isUsed = usages.some(usage => 
        usage.type === 'path' && usage.reference === route.path
      );
    }
    
    // 检查名称使用
    if (!isUsed && route.name) {
      isUsed = usages.some(usage => 
        usage.type === 'name' && usage.reference === route.name
      );
    }
    
    // 检查通配符或动态路径使用
    if (!isUsed && route.path) {
      isUsed = usages.some(usage => {
        if (usage.type === 'path') {
          // 改进的路由匹配逻辑
          return matchesRoute(route.path, usage.reference);
        } else if (usage.type === 'dynamic-path') {
          // 检查动态路由构造是否匹配路由定义
          return matchesDynamicRoute(route.path, usage.reference);
        }
        return false;
      });
    }
    
    if (!isUsed) {
      unusedRoutes.push(route);
    }
  }
  
  return unusedRoutes;
}

// 获取代码在文件中的行号
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// 从动态路由代码中提取路由模式
function extractDynamicRoutePatterns(dynamicCode) {
  const patterns = [];
  
  // 处理模板字符串: `/user/${userId}` -> `/user/:id`
  if (dynamicCode.includes('${')) {
    let pattern = dynamicCode;
    
    // 移除引号
    pattern = pattern.replace(/^['"`]|['"`]$/g, '');
    
    // 将 ${variable} 替换为 :param
    pattern = pattern.replace(/\$\{[^}]+\}/g, ':param');
    
    // 简化连续参数: /:param/:param/:param -> /:param1/:param2/:param3
    let paramCounter = 1;
    pattern = pattern.replace(/:param/g, () => `:param${paramCounter++}`);
    
    patterns.push(pattern);
  }
  
  // 处理字符串拼接: '/user/' + userId -> '/user/:id'
  if (dynamicCode.includes('+')) {
    const parts = dynamicCode.split('+');
    let basePath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.startsWith("'") || part.startsWith('"') || part.startsWith('`')) {
        // 字符串字面量
        basePath += part.replace(/^['"`]|['"`]$/g, '');
      } else {
        // 变量，替换为参数
        basePath += ':param';
      }
    }
    
    patterns.push(basePath);
  }
  
  return patterns;
}

// 改进的动态路由匹配逻辑
function matchesDynamicRoute(routePattern, usagePattern) {
  // 将路由模式转换为正则表达式
  // /user/:id -> /user/[^/]+
  // /mobile/:departmentId/:apiCode/:apiSecret -> /mobile/[^/]+/[^/]+/[^/]+
  
  const routeRegex = routePattern
    .replace(/:[^/]+/g, '[^/]+')  // 参数占位符
    .replace(/\?/g, '?')          // 可选参数
    .replace(/\*/g, '.*');        // 通配符
  
  const usageRegex = usagePattern
    .replace(/:param\d*/g, '[^/]+'); // 动态生成的参数
  
  try {
    // 双向匹配
    const routeMatches = new RegExp('^' + routeRegex + '$').test(usagePattern);
    const usageMatches = new RegExp('^' + usageRegex + '$').test(routePattern);
    
    return routeMatches || usageMatches;
  } catch (error) {
    return false;
  }
}

// 通用路由匹配函数，处理各种路由模式
function matchesRoute(routePattern, usagePath) {
  if (routePattern === usagePath) {
    return true;
  }
  
  try {
    // 特殊处理Vue Router的通配符路由
    if (routePattern.includes(':pathMatch(.*)*')) {
      // /files/:pathMatch(.*)* 应该匹配 /files/ 后的任何路径
      const basePath = routePattern.split(':pathMatch(.*)*')[0];
      return usagePath.startsWith(basePath);
    }
    
    // 处理可选参数路由
    if (routePattern.includes('?')) {
      // 生成所有可能的路由模式
      const patterns = generateOptionalPatterns(routePattern);
      return patterns.some(pattern => {
        const regex = convertToRegex(pattern);
        return new RegExp('^' + regex + '$').test(usagePath);
      });
    }
    
    // 普通动态路由
    const regex = convertToRegex(routePattern);
    return new RegExp('^' + regex + '$').test(usagePath);
    
  } catch (error) {
    console.error('路由匹配错误:', error.message, '路由:', routePattern, '使用:', usagePath);
    return false;
  }
}

// 将路由模式转换为正则表达式
function convertToRegex(pattern) {
  let regex = pattern;
  
  // 转义正则表达式特殊字符
  regex = regex.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  
  // 处理动态参数: :id -> 匹配非斜杠字符
  regex = regex.replace(/:[\w]+/g, '[^/]+');
  
  return regex;
}

// 生成可选参数的所有可能模式
function generateOptionalPatterns(routePattern) {
  const patterns = [routePattern];
  
  // 找到所有可选参数
  const optionalParams = routePattern.match(/:[\w]+\?/g) || [];
  
  // 为每个可选参数生成有无该参数的版本
  for (const param of optionalParams) {
    const newPatterns = [];
    for (const pattern of patterns) {
      // 包含该参数的版本（移除?号）
      newPatterns.push(pattern.replace(param, param.slice(0, -1)));
      // 不包含该参数的版本（移除整个路径段）
      newPatterns.push(pattern.replace('/' + param, ''));
    }
    patterns.push(...newPatterns);
  }
  
  // 去重
  return [...new Set(patterns)];
}

// 处理自定义入口文件中的路由定义
function handleCustomEntryRoutes(customEntryFiles, routeDefinitions, projectDir) {
  const customUsages = [];
  
  for (const entryFile of customEntryFiles) {
    const entryPath = path.resolve(projectDir, entryFile);
    
    // 检查这个入口文件是否是路由文件
    const mockFile = { relativePath: entryFile, path: entryPath };
    if (isRouterFile(mockFile)) {
      console.log(`🛣️  检测到路由入口文件: ${entryFile}`);
      
      // 如果是路由文件，将该文件中定义的所有路由标记为已使用
      // 标准化路径分隔符以支持跨平台匹配
      const normalizedEntryFile = entryFile.replace(/\\/g, '/');
      const routesInFile = routeDefinitions.filter(route => {
        const normalizedRouteFile = route.file.replace(/\\/g, '/');
        return normalizedRouteFile === normalizedEntryFile;
      });
      
      for (const route of routesInFile) {
        // 为路径和名称都添加使用记录
        if (route.path) {
          customUsages.push({
            reference: route.path,
            type: 'path',
            file: entryFile,
            line: route.line,
            source: 'custom-entry'
          });
        }
        
        if (route.name) {
          customUsages.push({
            reference: route.name,
            type: 'name',
            file: entryFile,
            line: route.line,
            source: 'custom-entry'
          });
        }
      }
      
      if (routesInFile.length > 0) {
        console.log(`   📍 标记 ${routesInFile.length} 个路由为已使用（来自自定义入口文件）`);
      }
    }
  }
  
  return customUsages;
}

module.exports = {
  analyzeRouterUsage,
  isRouterFile,
  extractRouteDefinitions,
  extractRouteUsages,
  findUnusedRoutes,
  handleCustomEntryRoutes
};