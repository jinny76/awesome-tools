const path = require('path');
const fs = require('fs').promises;
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// 数据目录 - 使用被测试项目的目录而不是工具目录
// 支持通过环境变量自定义，默认在当前工作目录的.api-test目录下
const DATA_DIR = process.env.API_TEST_DATA_DIR || path.join(process.cwd(), '.api-test');
const ENVS_FILE = path.join(DATA_DIR, 'environments.json');

/**
 * 启动API测试命令
 */
async function startApiTest(options) {
  // 确保数据目录存在
  await ensureDataDirectories();
  
  if (options.mcpServer) {
    // 启动MCP服务器
    await startMCPServer();
  } else if (options.wizard) {
    // 启动配置向导
    await runConfigWizard();
  } else if (options.listEnv) {
    // 列出所有环境
    await listEnvironments();
  } else if (options.listSuites) {
    // 列出所有测试套件
    await listTestSuites();
  } else if (options.createEnv) {
    // 创建新环境
    await createEnvironmentWizard(options.createEnv);
  } else if (options.deleteEnv) {
    // 删除环境
    await deleteEnvironment(options.deleteEnv);
  } else if (options.env) {
    // 切换环境
    await switchEnvironment(options.env);
  } else {
    // 显示帮助信息
    showHelp();
  }
}

/**
 * 确保数据目录存在
 */
async function ensureDataDirectories() {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, 'suites'),
    path.join(DATA_DIR, 'results'),
    path.join(DATA_DIR, 'snapshots')
  ];
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  
  // 初始化环境配置文件
  try {
    await fs.access(ENVS_FILE);
  } catch {
    await fs.writeFile(ENVS_FILE, JSON.stringify({ environments: [], active: null }, null, 2));
  }
}

/**
 * 启动MCP服务器
 */
async function startMCPServer() {
  const currentDir = process.cwd();
  const serverPath = path.resolve(__dirname, '../../mcp-test/server.js');
  
  // 检查环境配置并让用户选择活动环境
  const activeEnv = await selectActiveEnvironment();
  
  console.log('🚀 启动API测试MCP服务器...');
  console.log('📍 服务器路径: mcp-test/server.js');
  console.log(`📁 项目目录: ${currentDir}`);
  console.log(`💾 数据存储: ${path.join(currentDir, '.api-test')}`);
  if (activeEnv) {
    console.log(`🎯 活动环境: ${activeEnv}`);
  }
  console.log('');
  console.log('请在 Claude Desktop 中添加以下配置:');
  console.log('```json');
  console.log('{');
  console.log('  "mcpServers": {');
  console.log('    "api-test": {');
  console.log('      "command": "node",');
  console.log(`      "args": ["${serverPath}", "--project-dir", "${currentDir}"]`);
  console.log('    }');
  console.log('  }');
  console.log('}');
  console.log('```');
  console.log('');
  console.log('或使用命令:');
  console.log(`claude mcp add api-test -- node "${serverPath}" --project-dir "${currentDir}"`);
  console.log('');
  console.log('按 Ctrl+C 退出...');
  
  // 启动服务器进程，传入项目目录参数
  const child = spawn('node', [serverPath, '--project-dir', currentDir], {
    stdio: 'inherit'
  });
  
  child.on('error', (error) => {
    console.error('❌ 服务器启动失败:', error.message);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    console.log(`服务器已退出 (代码: ${code})`);
    process.exit(code);
  });
}

/**
 * 选择活动环境
 */
async function selectActiveEnvironment() {
  try {
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    if (data.environments.length === 0) {
      console.log('⚠️ 没有配置任何测试环境');
      console.log('请先使用 `ats api-test --wizard` 创建测试环境');
      return null;
    }
    
    // 如果只有一个环境，自动激活
    if (data.environments.length === 1) {
      const env = data.environments[0];
      if (data.active !== env.name) {
        data.active = env.name;
        await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ 自动激活唯一环境: ${env.name}`);
      }
      return env.name;
    }
    
    // 如果已有活动环境，询问是否切换
    if (data.active) {
      console.log(`\n当前活动环境: ${data.active}`);
      console.log('\n可用环境:');
      data.environments.forEach((env, index) => {
        const isActive = data.active === env.name;
        const marker = isActive ? '✅' : '  ';
        console.log(`${index + 1}. ${marker} ${env.name} (${env.baseUrl})`);
      });
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const question = (prompt) => new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
      
      try {
        const choice = await question('\n选择环境编号，或按回车保持当前环境: ');
        
        if (choice.trim()) {
          const index = parseInt(choice) - 1;
          if (index >= 0 && index < data.environments.length) {
            const selectedEnv = data.environments[index];
            data.active = selectedEnv.name;
            await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
            console.log(`✅ 已切换到环境: ${selectedEnv.name}`);
            return selectedEnv.name;
          } else {
            console.log('❌ 无效选择，保持当前环境');
          }
        }
        
        return data.active;
      } finally {
        rl.close();
      }
    }
    
    // 没有活动环境，必须选择一个
    console.log('\n没有活动环境，请选择一个:');
    data.environments.forEach((env, index) => {
      console.log(`${index + 1}. ${env.name} (${env.baseUrl})`);
    });
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const question = (prompt) => new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
    
    try {
      const choice = await question('\n选择环境编号 [默认: 1]: ') || '1';
      const index = parseInt(choice) - 1;
      
      if (index >= 0 && index < data.environments.length) {
        const selectedEnv = data.environments[index];
        data.active = selectedEnv.name;
        await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ 已激活环境: ${selectedEnv.name}`);
        return selectedEnv.name;
      } else {
        console.log('❌ 无效选择，使用第一个环境');
        const firstEnv = data.environments[0];
        data.active = firstEnv.name;
        await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
        return firstEnv.name;
      }
    } finally {
      rl.close();
    }
    
  } catch (error) {
    console.log('⚠️ 无法读取环境配置，请先使用 `ats api-test --wizard` 创建测试环境');
    return null;
  }
}

/**
 * 运行配置向导
 */
async function runConfigWizard() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
  
  console.log('🧙 API测试配置向导');
  console.log('==================');
  
  try {
    while (true) {
      console.log('');
      console.log('请选择操作:');
      console.log('1. 新增测试环境');
      console.log('2. 列出所有环境');
      console.log('3. 修改测试环境');
      console.log('4. 删除测试环境');
      console.log('5. 启动MCP服务器');
      console.log('6. 退出');
      console.log('');
      
      const choice = await question('请选择 (1-6) [默认: 1]: ') || '1';
      
      switch (choice) {
        case '1':
          await createEnvironmentFlow(rl, question);
          break;
        case '2':
          await listEnvironments();
          break;
        case '3':
          await modifyEnvironmentFlow(rl, question);
          break;
        case '4':
          await deleteEnvironmentFlow(rl, question);
          break;
        case '5':
          console.log('\n🚀 即将启动MCP服务器...');
          rl.close();
          await startMCPServer();
          return;
        case '6':
          console.log('👋 再见！');
          return;
        default:
          console.log('❌ 无效选择');
          break;
      }
      
      // 在操作完成后，询问是否继续
      if (choice !== '6' && choice !== '5') {
        console.log('\n按回车键返回主菜单，或输入 q 退出...');
        const continueChoice = await question('');
        if (continueChoice.toLowerCase() === 'q') {
          console.log('👋 再见！');
          return;
        }
      }
    }
  } finally {
    if (!rl.closed) {
      rl.close();
    }
  }
}

/**
 * 创建环境流程
 */
async function createEnvironmentFlow(rl, question) {
  console.log('\n📝 创建新测试环境');
  console.log('================');
  console.log('');
  
  // 询问环境名称
  const name = await question('环境名称 [默认: dev]: ') || 'dev';
  
  // 询问基础URL
  const baseUrl = await question('API基础URL [默认: http://localhost:8080]: ') || 'http://localhost:8080';
  
  // 询问Swagger路径
  const swaggerUrl = await question('Swagger文档路径 [默认: /v3/api-docs]: ') || '/v3/api-docs';
  
  // 询问认证类型
  console.log('\n认证类型:');
  console.log('1. JWT');
  console.log('2. Session');
  console.log('3. Basic Auth');
  console.log('4. 无认证');
  const authChoice = await question('选择认证类型 [默认: 4]: ') || '4';
  
  let authConfig = null;
  if (authChoice !== '4') {
    authConfig = {
      type: authChoice === '1' ? 'jwt' : authChoice === '2' ? 'session' : 'basic'
    };
    
    authConfig.loginEndpoint = await question('登录接口路径 [默认: /api/auth/login]: ') || '/api/auth/login';
    authConfig.username = await question('用户名 [默认: admin]: ') || 'admin';
    authConfig.password = await question('密码 [默认: 123456]: ') || '123456';
    
    if (authChoice === '1') {
      authConfig.tokenField = await question('Token字段路径 [默认: token]: ') || 'token';
      authConfig.headerName = await question('请求头名称 [默认: Authorization]: ') || 'Authorization';
      authConfig.headerPrefix = await question('请求头前缀 [默认: Bearer]: ') || 'Bearer';
    }
  }
  
  // 询问数据库配置
  const configureDb = await question('\n是否配置数据库? [默认: n]: ') || 'n';
  let database = null;
  if (configureDb.toLowerCase() === 'y') {
    console.log('\n数据库类型:');
    console.log('1. MySQL');
    console.log('2. PostgreSQL');
    const dbChoice = await question('选择数据库类型 [默认: 1]: ') || '1';
    
    database = {
      type: dbChoice === '1' ? 'mysql' : 'postgres',
      host: await question('数据库主机 [默认: localhost]: ') || 'localhost',
      port: parseInt(await question(`数据库端口 [默认: ${dbChoice === '1' ? '3306' : '5432'}]: `) || (dbChoice === '1' ? '3306' : '5432')),
      database: await question('数据库名 [默认: test_db]: ') || 'test_db',
      user: await question('用户名 [默认: root]: ') || 'root',
      password: await question('密码 [默认: 123456]: ') || '123456'
    };
  }
  
  // 保存配置
  const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
  
  // 检查是否已存在
  if (data.environments.find(env => env.name === name)) {
    const overwrite = await question(`\n环境 '${name}' 已存在，是否覆盖? [默认: n]: `) || 'n';
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ 取消创建');
      return;
    }
    data.environments = data.environments.filter(env => env.name !== name);
  }
  
  const env = {
    id: generateId(),
    name,
    baseUrl,
    swaggerUrl,
    authConfig,
    database,
    createdAt: new Date().toISOString()
  };
  
  data.environments.push(env);
  
  // 如果是第一个环境，设为活动环境
  if (data.environments.length === 1) {
    data.active = name;
  }
  
  await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ 环境 '${name}' 创建成功！`);
  
  if (data.active === name) {
    console.log(`✅ 已设为当前活动环境`);
  }
}

/**
 * 创建环境向导
 */
async function createEnvironmentWizard(name) {
  console.log(`创建新环境: ${name}`);
  // 复用配置向导，但预填环境名称
  await runConfigWizard();
}

/**
 * 列出所有环境
 */
async function listEnvironments() {
  try {
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    if (data.environments.length === 0) {
      console.log('📭 还没有配置任何测试环境');
      console.log('使用 `ats api-test --wizard` 创建第一个环境');
      return;
    }
    
    console.log('📋 测试环境列表:');
    console.log('================');
    
    for (const env of data.environments) {
      const isActive = data.active === env.name;
      const marker = isActive ? '✅' : '  ';
      console.log(`${marker} ${env.name}`);
      console.log(`   URL: ${env.baseUrl}`);
      console.log(`   认证: ${env.authConfig ? env.authConfig.type : '无'}`);
      console.log(`   数据库: ${env.database ? env.database.type : '未配置'}`);
      console.log(`   创建时间: ${new Date(env.createdAt).toLocaleString()}`);
      console.log('');
    }
    
    if (data.active) {
      console.log(`当前活动环境: ${data.active}`);
    }
  } catch (error) {
    console.error('❌ 读取环境配置失败:', error.message);
  }
}

/**
 * 列出所有测试套件
 */
async function listTestSuites() {
  const suitesDir = path.join(DATA_DIR, 'suites');
  
  try {
    const files = await fs.readdir(suitesDir);
    const suites = files.filter(f => f.endsWith('.json'));
    
    if (suites.length === 0) {
      console.log('📭 还没有保存任何测试套件');
      console.log('使用 Claude 和 MCP 服务创建测试套件');
      return;
    }
    
    console.log('📋 测试套件列表:');
    console.log('================');
    
    for (const file of suites) {
      const content = await fs.readFile(path.join(suitesDir, file), 'utf8');
      const suite = JSON.parse(content);
      
      console.log(`📦 ${suite.name}`);
      if (suite.description) {
        console.log(`   ${suite.description}`);
      }
      console.log(`   测试用例: ${suite.testCases ? suite.testCases.length : 0} 个`);
      console.log(`   环境: ${suite.environment || '未指定'}`);
      console.log(`   创建时间: ${new Date(suite.createdAt).toLocaleString()}`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ 读取测试套件失败:', error.message);
  }
}

/**
 * 切换环境
 */
async function switchEnvironment(name) {
  try {
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    const env = data.environments.find(e => e.name === name);
    if (!env) {
      console.error(`❌ 环境 '${name}' 不存在`);
      console.log('使用 `ats api-test --list-env` 查看所有环境');
      return;
    }
    
    data.active = name;
    await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ 已切换到环境: ${name}`);
    console.log(`   URL: ${env.baseUrl}`);
    console.log(`   认证: ${env.authConfig ? env.authConfig.type : '无'}`);
  } catch (error) {
    console.error('❌ 切换环境失败:', error.message);
  }
}

/**
 * 删除环境
 */
async function deleteEnvironment(name) {
  try {
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    const index = data.environments.findIndex(e => e.name === name);
    if (index === -1) {
      console.error(`❌ 环境 '${name}' 不存在`);
      return;
    }
    
    data.environments.splice(index, 1);
    
    // 如果删除的是活动环境，清空活动环境
    if (data.active === name) {
      data.active = data.environments.length > 0 ? data.environments[0].name : null;
    }
    
    await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ 环境 '${name}' 已删除`);
    
    if (data.active) {
      console.log(`当前活动环境: ${data.active}`);
    }
  } catch (error) {
    console.error('❌ 删除环境失败:', error.message);
  }
}

/**
 * 修改环境流程
 */
async function modifyEnvironmentFlow(rl, question) {
  try {
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    if (data.environments.length === 0) {
      console.log('\n📭 还没有配置任何测试环境');
      console.log('请先创建一个环境');
      return;
    }
    
    console.log('\n✏️ 修改测试环境');
    console.log('===============');
    console.log('');
    console.log('现有环境:');
    data.environments.forEach((env, index) => {
      const isActive = data.active === env.name;
      const marker = isActive ? '✅' : '  ';
      console.log(`${index + 1}. ${marker} ${env.name} (${env.baseUrl})`);
    });
    console.log('');
    
    const choice = await question('选择要修改的环境编号: ');
    const index = parseInt(choice) - 1;
    
    if (index < 0 || index >= data.environments.length) {
      console.log('❌ 无效选择');
      return;
    }
    
    const existingEnv = data.environments[index];
    console.log(`\n正在修改环境: ${existingEnv.name}`);
    console.log('按回车保持原值，输入新值进行修改');
    console.log('');
    
    // 修改各个字段
    const name = await question(`环境名称 [当前: ${existingEnv.name}]: `) || existingEnv.name;
    const baseUrl = await question(`API基础URL [当前: ${existingEnv.baseUrl}]: `) || existingEnv.baseUrl;
    const swaggerUrl = await question(`Swagger文档路径 [当前: ${existingEnv.swaggerUrl}]: `) || existingEnv.swaggerUrl;
    
    // 认证配置
    console.log('\n认证类型:');
    console.log('1. JWT');
    console.log('2. Session');
    console.log('3. Basic Auth');
    console.log('4. 无认证');
    const currentAuthType = existingEnv.authConfig ? 
      (existingEnv.authConfig.type === 'jwt' ? '1' : 
       existingEnv.authConfig.type === 'session' ? '2' : 
       existingEnv.authConfig.type === 'basic' ? '3' : '4') : '4';
    const authChoice = await question(`选择认证类型 [当前: ${currentAuthType}]: `) || currentAuthType;
    
    let authConfig = null;
    if (authChoice !== '4') {
      authConfig = {
        type: authChoice === '1' ? 'jwt' : authChoice === '2' ? 'session' : 'basic'
      };
      
      const currentLogin = existingEnv.authConfig?.loginEndpoint || '/api/auth/login';
      const currentUser = existingEnv.authConfig?.username || 'admin';
      const currentPass = existingEnv.authConfig?.password || '123456';
      
      authConfig.loginEndpoint = await question(`登录接口路径 [当前: ${currentLogin}]: `) || currentLogin;
      authConfig.username = await question(`用户名 [当前: ${currentUser}]: `) || currentUser;
      authConfig.password = await question(`密码 [当前: ${currentPass}]: `) || currentPass;
      
      if (authChoice === '1') {
        const currentToken = existingEnv.authConfig?.tokenField || 'token';
        const currentHeader = existingEnv.authConfig?.headerName || 'Authorization';
        const currentPrefix = existingEnv.authConfig?.headerPrefix || 'Bearer';
        
        authConfig.tokenField = await question(`Token字段路径 [当前: ${currentToken}]: `) || currentToken;
        authConfig.headerName = await question(`请求头名称 [当前: ${currentHeader}]: `) || currentHeader;
        authConfig.headerPrefix = await question(`请求头前缀 [当前: ${currentPrefix}]: `) || currentPrefix;
      }
    }
    
    // 数据库配置
    const hasDb = existingEnv.database ? 'y' : 'n';
    const configureDb = await question(`\n是否配置数据库? [当前: ${hasDb}]: `) || hasDb;
    let database = null;
    if (configureDb.toLowerCase() === 'y') {
      console.log('\n数据库类型:');
      console.log('1. MySQL');
      console.log('2. PostgreSQL');
      const currentDbType = existingEnv.database?.type === 'postgres' ? '2' : '1';
      const dbChoice = await question(`选择数据库类型 [当前: ${currentDbType}]: `) || currentDbType;
      
      const currentHost = existingEnv.database?.host || 'localhost';
      const currentPort = existingEnv.database?.port || (dbChoice === '1' ? 3306 : 5432);
      const currentDbName = existingEnv.database?.database || 'test_db';
      const currentDbUser = existingEnv.database?.user || 'root';
      const currentDbPass = existingEnv.database?.password || '123456';
      
      database = {
        type: dbChoice === '1' ? 'mysql' : 'postgres',
        host: await question(`数据库主机 [当前: ${currentHost}]: `) || currentHost,
        port: parseInt(await question(`数据库端口 [当前: ${currentPort}]: `) || currentPort),
        database: await question(`数据库名 [当前: ${currentDbName}]: `) || currentDbName,
        user: await question(`用户名 [当前: ${currentDbUser}]: `) || currentDbUser,
        password: await question(`密码 [当前: ${currentDbPass}]: `) || currentDbPass
      };
    }
    
    // 保存修改
    const updatedEnv = {
      ...existingEnv,
      name,
      baseUrl,
      swaggerUrl,
      authConfig,
      database,
      updatedAt: new Date().toISOString()
    };
    
    data.environments[index] = updatedEnv;
    
    // 如果环境名称变了，更新活动环境
    if (data.active === existingEnv.name && name !== existingEnv.name) {
      data.active = name;
    }
    
    await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ 环境 '${name}' 修改成功！`);
    
  } catch (error) {
    console.error('❌ 修改环境失败:', error.message);
  }
}

/**
 * 删除环境流程
 */
async function deleteEnvironmentFlow(rl, question) {
  try {
    const data = JSON.parse(await fs.readFile(ENVS_FILE, 'utf8'));
    
    if (data.environments.length === 0) {
      console.log('\n📭 还没有配置任何测试环境');
      return;
    }
    
    console.log('\n🗑️ 删除测试环境');
    console.log('===============');
    console.log('');
    console.log('现有环境:');
    data.environments.forEach((env, index) => {
      const isActive = data.active === env.name;
      const marker = isActive ? '✅' : '  ';
      console.log(`${index + 1}. ${marker} ${env.name} (${env.baseUrl})`);
    });
    console.log('');
    
    const choice = await question('选择要删除的环境编号: ');
    const index = parseInt(choice) - 1;
    
    if (index < 0 || index >= data.environments.length) {
      console.log('❌ 无效选择');
      return;
    }
    
    const envToDelete = data.environments[index];
    const confirm = await question(`\n确认删除环境 '${envToDelete.name}'? (y/n) [默认: n]: `) || 'n';
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ 取消删除');
      return;
    }
    
    // 删除环境
    data.environments.splice(index, 1);
    
    // 如果删除的是活动环境，重新设置活动环境
    if (data.active === envToDelete.name) {
      data.active = data.environments.length > 0 ? data.environments[0].name : null;
    }
    
    await fs.writeFile(ENVS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ 环境 '${envToDelete.name}' 已删除`);
    
    if (data.active) {
      console.log(`当前活动环境: ${data.active}`);
    } else {
      console.log('当前没有活动环境');
    }
    
  } catch (error) {
    console.error('❌ 删除环境失败:', error.message);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('API自动化测试工具');
  console.log('================');
  console.log('');
  console.log('使用方法:');
  console.log('  ats api-test [选项]');
  console.log('');
  console.log('选项:');
  console.log('  -w, --wizard         启动配置向导');
  console.log('  --env <name>         切换到指定环境');
  console.log('  --list-env           列出所有测试环境');
  console.log('  --list-suites        列出所有测试套件');
  console.log('  --create-env <name>  创建新测试环境');
  console.log('  --delete-env <name>  删除测试环境');
  console.log('  --mcp-server         启动测试MCP服务器');
  console.log('');
  console.log('示例:');
  console.log('  ats api-test --wizard         # 创建第一个测试环境');
  console.log('  ats api-test --list-env       # 查看所有环境');
  console.log('  ats api-test --env dev        # 切换到dev环境');
  console.log('  ats api-test --mcp-server     # 启动MCP服务器');
  console.log('');
  console.log('MCP集成:');
  console.log('  1. 使用 --mcp-server 启动测试MCP服务器');
  console.log('  2. 在 Claude Desktop 中配置MCP服务器');
  console.log('  3. 使用 Claude 进行智能API测试');
  console.log('');
  console.log('数据存储:');
  console.log(`  测试数据存储在: ${DATA_DIR}`);
  console.log('  可通过环境变量 API_TEST_DATA_DIR 自定义路径');
  console.log('');
  console.log('注意事项:');
  console.log('  在Cursor/Claude Desktop中使用MCP时，需要传入--project-dir参数');
  console.log('  建议在项目根目录运行 ats api-test --mcp-server 获取正确配置');
}

/**
 * 生成唯一ID
 */
function generateId() {
  return 'env_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

module.exports = {
  startApiTest
};