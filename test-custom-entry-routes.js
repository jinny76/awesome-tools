const { analyzeRouterUsage } = require('./lib/utils/router-analyzer');
const { scanSourceFiles } = require('./lib/utils/file-analyzer');

async function test() {
  const projectDir = 'J:/projects/local_tools/test-router-analysis';
  const projectConfig = { alias: { '@': 'src' }, extensions: ['.vue', '.js', '.jsx', '.ts', '.tsx', '.json'] };
  const customEntryFiles = ['src/router/api-routes.js'];
  
  const files = await scanSourceFiles(projectDir, {});
  const analysis = analyzeRouterUsage(files, projectDir, projectConfig, customEntryFiles);
  
  console.log('路由定义:');
  analysis.routeDefinitions.forEach((route, i) => {
    console.log(`${i + 1}. ${route.path} (${route.name || 'no name'}) - ${route.file}:${route.line}`);
  });
  
  console.log('\n路由使用:');
  analysis.routeUsages.forEach((usage, i) => {
    console.log(`${i + 1}. ${usage.reference} (${usage.type}) - ${usage.file}:${usage.line} ${usage.source ? `[${usage.source}]` : ''}`);
  });
  
  console.log('\n来自自定义入口的使用:');
  const customUsages = analysis.routeUsages.filter(u => u.source === 'custom-entry');
  customUsages.forEach((usage, i) => {
    console.log(`${i + 1}. ${usage.reference} (${usage.type}) - ${usage.file}:${usage.line}`);
  });
  
  console.log('\n未使用的路由:');
  analysis.unusedRoutes.forEach((route, i) => {
    console.log(`${i + 1}. ${route.path} (${route.name || 'no name'})`);
  });
}

test().catch(console.error);