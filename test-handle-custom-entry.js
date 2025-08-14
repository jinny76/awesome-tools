const { handleCustomEntryRoutes, extractRouteDefinitions, isRouterFile } = require('./lib/utils/router-analyzer');
const fs = require('fs');

const projectDir = 'J:/projects/local_tools/test-router-analysis';
const customEntryFiles = ['src/router/api-routes.js'];

// 先获取路由定义
const routeDefinitions = [];
const entryPath = 'J:/projects/local_tools/test-router-analysis/src/router/api-routes.js';
const content = fs.readFileSync(entryPath, 'utf8');
const mockFile = { relativePath: 'src/router/api-routes.js', path: entryPath };

console.log('文件是否为路由文件:', isRouterFile(mockFile));

const routes = extractRouteDefinitions(content, mockFile);
console.log('提取的路由定义:', routes);

const customUsages = handleCustomEntryRoutes(customEntryFiles, routes, projectDir);
console.log('自定义入口使用:', customUsages);