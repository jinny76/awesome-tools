const fs = require('fs');
const path = require('path');

// Vue 运行时使用情况扫描器
class VueRuntimeScanner {
  constructor() {
    this.trackerScript = this.generateTrackerScript();
  }

  // 生成注入到页面的跟踪脚本
  generateTrackerScript() {
    return `
<script>
// Vue 运行时使用情况跟踪器
(function() {
  window.__vueUsageTracker = {
    // 使用数据收集
    usageData: {
      components: new Set(),
      methods: new Set(),
      computed: new Set(),
      routes: new Set(),
      imports: new Set(),
      events: new Set()
    },
    
    // 开始时间
    startTime: Date.now(),
    
    // 初始化跟踪器
    init() {
      console.log('🔍 Vue Usage Tracker 初始化中...');
      
      this.patchVue();
      this.patchRouter();
      this.trackImports();
      this.trackGenericActivity();
      this.setupReporting();
      
      // 记录初始化状态
      this.usageData.events.add('Tracker initialized at ' + new Date().toISOString());
      this.usageData.events.add('URL: ' + window.location.href);
      this.usageData.events.add('User Agent: ' + navigator.userAgent.substring(0, 50));
    },
    
    // 修补 Vue 以跟踪组件使用
    patchVue() {
      // 尝试多种方式检测Vue
      const vue = this.detectVue();
      
      if (!vue) {
        // 延迟检测，Vue可能还未加载
        setTimeout(() => {
          this.patchVue();
        }, 1000);
        return;
      }
      
      this.usageData.events.add('Vue detected: ' + (vue.version || 'unknown version'));
      
      // 安全地跟踪组件创建
      if (vue.extend && typeof vue.extend === 'function') {
        const originalExtend = vue.extend;
        vue.extend = function(options) {
          if (options && options.name) {
            window.__vueUsageTracker.usageData.components.add(options.name);
          }
          return originalExtend.call(this, options);
        };
      }
      
      // 安全地跟踪组件挂载
      if (vue.prototype && vue.prototype.$mount && typeof vue.prototype.$mount === 'function') {
        const originalMount = vue.prototype.$mount;
        vue.prototype.$mount = function(...args) {
          if (this.$options && this.$options.name) {
            window.__vueUsageTracker.usageData.components.add(this.$options.name);
          }
          
          // 跟踪方法调用
          if (this.$nextTick && typeof this.$nextTick === 'function') {
            this.$nextTick(() => {
              window.__vueUsageTracker.trackMethodCalls(this);
            });
          }
          
          return originalMount.apply(this, args);
        };
      } else {
        // Vue 3 或其他版本的处理
        this.usageData.events.add('Vue prototype.$mount not found, trying alternative approach');
        this.patchVue3Alternative(vue);
      }
    },
    
    // 检测Vue实例
    detectVue() {
      // Vue 3 优先检测
      if (typeof window.Vue !== 'undefined' && window.Vue.createApp) {
        this.usageData.events.add('Vue 3 detected from window.Vue');
        return window.Vue;
      }
      
      if (typeof Vue !== 'undefined' && Vue.createApp) {
        this.usageData.events.add('Vue 3 detected from global Vue');
        return Vue;
      }
      
      // 检查Vue DevTools标识
      if (typeof window.__VUE__ !== 'undefined') {
        this.usageData.events.add('Vue DevTools detected');
        return window.__VUE__;
      }
      
      // Vue 2 兼容
      if (typeof Vue !== 'undefined' && Vue.prototype) return Vue;
      if (typeof window.Vue !== 'undefined' && window.Vue.prototype) return window.Vue;
      
      // 检查应用实例相关的全局变量
      const potentialVueKeys = ['app', 'vueApp', '__vue_app__', '_vue'];
      for (const key of potentialVueKeys) {
        if (window[key] && typeof window[key] === 'object') {
          const app = window[key];
          if (app.mount || app.use || app.component) {
            this.usageData.events.add('Vue app instance found: ' + key);
            return { createApp: () => app, version: '3.x', isAppInstance: true };
          }
        }
      }
      
      // 检查DOM中是否有Vue应用特征
      const vueElements = document.querySelectorAll('[data-v-]');
      if (vueElements.length > 0) {
        this.usageData.events.add('Vue scoped CSS found in DOM: ' + vueElements.length + ' elements');
      }
      
      // 检查Vue Router相关
      if (window.__VUE_ROUTER__) {
        this.usageData.events.add('Vue Router detected');
      }
      
      // 检查Pinia相关
      if (window.__PINIA__) {
        this.usageData.events.add('Pinia store detected');
      }
      
      // 检查Element Plus相关
      if (window.ElementPlus || document.querySelector('.el-button, .el-input, [class*="el-"]')) {
        this.usageData.events.add('Element Plus components detected');
      }
      
      return null;
    },
    
    // Vue 3 替代方案
    patchVue3Alternative(vue) {
      // Vue 3 应用创建跟踪
      if (vue && vue.createApp && typeof vue.createApp === 'function') {
        const originalCreateApp = vue.createApp;
        vue.createApp = function(rootComponent, rootProps) {
          window.__vueUsageTracker.usageData.events.add('Vue 3 app created with createApp');
          
          if (rootComponent) {
            if (rootComponent.name) {
              window.__vueUsageTracker.usageData.components.add(rootComponent.name);
            }
            if (rootComponent.__name) {
              window.__vueUsageTracker.usageData.components.add(rootComponent.__name);
            }
          }
          
          const app = originalCreateApp.call(this, rootComponent, rootProps);
          
          // 跟踪应用挂载
          if (app.mount && typeof app.mount === 'function') {
            const originalMount = app.mount;
            app.mount = function(selector) {
              window.__vueUsageTracker.usageData.events.add('Vue 3 app mounted to: ' + selector);
              const instance = originalMount.call(this, selector);
              
              // 尝试从挂载的实例中提取更多信息
              setTimeout(() => {
                window.__vueUsageTracker.trackVue3Instance(instance);
              }, 100);
              
              return instance;
            };
          }
          
          // 跟踪插件使用
          if (app.use && typeof app.use === 'function') {
            const originalUse = app.use;
            app.use = function(plugin, ...options) {
              let pluginName = 'unknown';
              if (plugin && plugin.name) pluginName = plugin.name;
              else if (plugin && plugin.install && plugin.install.name) pluginName = plugin.install.name;
              else if (typeof plugin === 'function' && plugin.name) pluginName = plugin.name;
              
              window.__vueUsageTracker.usageData.events.add('Vue 3 plugin used: ' + pluginName);
              return originalUse.call(this, plugin, ...options);
            };
          }
          
          // 跟踪全局组件注册
          if (app.component && typeof app.component === 'function') {
            const originalComponent = app.component;
            app.component = function(name, component) {
              if (name && !component) {
                // 获取组件
                return originalComponent.call(this, name);
              } else {
                // 注册组件
                window.__vueUsageTracker.usageData.components.add(name);
                window.__vueUsageTracker.usageData.events.add('Vue 3 global component registered: ' + name);
                return originalComponent.call(this, name, component);
              }
            };
          }
          
          return app;
        };
      }
      
      // 尝试跟踪现有的应用实例
      this.trackExistingVue3Apps();
    },
    
    // 跟踪Vue 3实例
    trackVue3Instance(instance) {
      try {
        if (instance && instance.$) {
          const vm = instance.$;
          if (vm.type && vm.type.name) {
            this.usageData.components.add(vm.type.name);
          }
          if (vm.type && vm.type.__name) {
            this.usageData.components.add(vm.type.__name);
          }
        }
      } catch (e) {
        this.usageData.events.add('Error tracking Vue 3 instance: ' + e.message);
      }
    },
    
    // 跟踪现有的Vue 3应用
    trackExistingVue3Apps() {
      // 检查已挂载的Vue应用
      const vueApps = document.querySelectorAll('[data-v-app]');
      vueApps.forEach((el, index) => {
        this.usageData.events.add('Existing Vue 3 app found: #' + (index + 1));
      });
      
      // 监听Composition API的使用
      this.trackCompositionAPI();
    },
    
    // 跟踪Composition API使用
    trackCompositionAPI() {
      // 监听常见的Composition API函数
      const compositionFunctions = ['ref', 'reactive', 'computed', 'watch', 'watchEffect', 'onMounted', 'onUnmounted'];
      
      compositionFunctions.forEach(fnName => {
        if (window.Vue && window.Vue[fnName]) {
          const original = window.Vue[fnName];
          window.Vue[fnName] = function(...args) {
            window.__vueUsageTracker.usageData.events.add('Composition API used: ' + fnName);
            return original.apply(this, args);
          };
        }
      });
    },
    
    // Vue 3 支持
    patchVue3() {
      // 监听 Vue 3 应用创建
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.__vue_app__) {
              this.trackVue3App(node.__vue_app__);
            }
          });
        });
      });
      
      observer.observe(document, { childList: true, subtree: true });
    },
    
    // 跟踪路由使用
    patchRouter() {
      // Vue Router 4 (Vue 3) 跟踪
      if (window.VueRouter && window.VueRouter.createRouter) {
        this.usageData.events.add('Vue Router 4 detected');
        
        // 监听 createRouter 调用
        const originalCreateRouter = window.VueRouter.createRouter;
        window.VueRouter.createRouter = function(options) {
          window.__vueUsageTracker.usageData.events.add('Vue Router created');
          
          const router = originalCreateRouter.call(this, options);
          window.__vueUsageTracker.patchRouterInstance(router);
          
          return router;
        };
      }
      
      // Vue Router 2/3 (Vue 2) 兼容
      if (window.$router || (window.Vue && window.Vue.prototype && window.Vue.prototype.$router)) {
        const router = window.$router || window.Vue.prototype.$router;
        this.patchRouterInstance(router);
      }
      
      // 检查现有的路由实例
      this.findExistingRouter();
    },
    
    // 跟踪路由实例
    patchRouterInstance(router) {
      if (!router) return;
      
      this.usageData.events.add('Router instance found, patching methods');
      
      // 跟踪路由导航方法
      ['push', 'replace', 'go', 'back', 'forward'].forEach(method => {
        if (router[method] && typeof router[method] === 'function') {
          const original = router[method];
          router[method] = function(location) {
            if (typeof location === 'string') {
              window.__vueUsageTracker.usageData.routes.add(location);
              window.__vueUsageTracker.usageData.events.add('Router.' + method + ': ' + location);
            } else if (location && location.path) {
              window.__vueUsageTracker.usageData.routes.add(location.path);
              window.__vueUsageTracker.usageData.events.add('Router.' + method + ': ' + location.path);
            } else if (location && location.name) {
              window.__vueUsageTracker.usageData.routes.add('name:' + location.name);
              window.__vueUsageTracker.usageData.events.add('Router.' + method + ': name=' + location.name);
            }
            return original.apply(this, arguments);
          };
        }
      });
      
      // 跟踪当前路由
      if (router.currentRoute) {
        let currentRoute;
        if (typeof router.currentRoute === 'object' && router.currentRoute.value) {
          // Vue Router 4
          currentRoute = router.currentRoute.value;
        } else {
          // Vue Router 2/3
          currentRoute = router.currentRoute;
        }
        
        if (currentRoute && currentRoute.path) {
          this.usageData.routes.add(currentRoute.path);
          this.usageData.events.add('Current route: ' + currentRoute.path);
        }
      }
      
      // 监听路由变化
      if (router.afterEach && typeof router.afterEach === 'function') {
        router.afterEach((to, from) => {
          if (to && to.path) {
            window.__vueUsageTracker.usageData.routes.add(to.path);
            window.__vueUsageTracker.usageData.events.add('Route changed to: ' + to.path);
          }
          if (to && to.name) {
            window.__vueUsageTracker.usageData.events.add('Route name: ' + to.name);
          }
        });
      }
    },
    
    // 查找现有的路由器实例
    findExistingRouter() {
      // 检查可能的全局路由器变量
      const routerKeys = ['router', '$router', '__router', '_router'];
      for (const key of routerKeys) {
        if (window[key] && typeof window[key] === 'object') {
          const router = window[key];
          if (router.push || router.currentRoute) {
            this.usageData.events.add('Router found in window.' + key);
            this.patchRouterInstance(router);
            break;
          }
        }
      }
    },
    
    // 跟踪方法调用
    trackMethodCalls(vueInstance) {
      try {
        if (!vueInstance || !vueInstance.$options) {
          return;
        }
        
        const methods = vueInstance.$options.methods || {};
        const computed = vueInstance.$options.computed || {};
        const componentName = vueInstance.$options.name || 'Anonymous';
        
        // 代理方法
        Object.keys(methods).forEach(methodName => {
          try {
            const originalMethod = vueInstance[methodName];
            if (typeof originalMethod === 'function') {
              vueInstance[methodName] = function(...args) {
                window.__vueUsageTracker.usageData.methods.add(
                  \`\${componentName}.\${methodName}\`
                );
                return originalMethod.apply(this, args);
              };
            }
          } catch (e) {
            console.warn('Error proxying method:', methodName, e);
          }
        });
        
        // 代理计算属性
        Object.keys(computed).forEach(propName => {
          try {
            const descriptor = Object.getOwnPropertyDescriptor(vueInstance, propName);
            if (!descriptor || descriptor.get) {
              Object.defineProperty(vueInstance, '_computed_' + propName, {
                get() {
                  window.__vueUsageTracker.usageData.computed.add(
                    \`\${componentName}.\${propName}\`
                  );
                  return computed[propName].call(this);
                }
              });
            }
          } catch (e) {
            console.warn('Error proxying computed property:', propName, e);
          }
        });
      } catch (error) {
        console.warn('Error in trackMethodCalls:', error);
      }
    },
    
    // 跟踪模块导入
    trackImports() {
      // 监听动态导入
      if (window.require && window.require.context) {
        const originalContext = window.require.context;
        window.require.context = function(...args) {
          window.__vueUsageTracker.usageData.imports.add(args[0]);
          return originalContext.apply(this, args);
        };
      }
    },
    
    // 跟踪通用应用活动
    trackGenericActivity() {
      // 跟踪点击事件
      document.addEventListener('click', (event) => {
        const target = event.target;
        const tagName = target.tagName.toLowerCase();
        const className = target.className || '';
        const id = target.id || '';
        
        let identifier = tagName;
        if (id) identifier += '#' + id;
        if (className) identifier += '.' + className.split(' ')[0];
        
        this.usageData.events.add('Click: ' + identifier);
      });
      
      // 跟踪路由变化（通过hashchange和popstate）
      window.addEventListener('hashchange', () => {
        this.usageData.routes.add(window.location.hash);
        this.usageData.events.add('Hash change: ' + window.location.hash);
      });
      
      window.addEventListener('popstate', () => {
        this.usageData.routes.add(window.location.pathname);
        this.usageData.events.add('Popstate: ' + window.location.pathname);
      });
      
      // 跟踪AJAX请求
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const url = args[0];
        window.__vueUsageTracker.usageData.events.add('Fetch: ' + url);
        return originalFetch.apply(this, args);
      };
      
      // 跟踪XMLHttpRequest
      const originalXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        window.__vueUsageTracker.usageData.events.add('XHR: ' + method + ' ' + url);
        return originalXHROpen.apply(this, arguments);
      };
      
      // 监听DOM变化，寻找Vue特征
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              // 检查Vue特征
              if (node.hasAttribute && (
                node.hasAttribute('v-if') ||
                node.hasAttribute('v-for') ||
                node.hasAttribute('v-show') ||
                node.getAttribute('class')?.includes('v-')
              )) {
                this.usageData.events.add('Vue directive detected in DOM');
              }
            }
          });
        });
      });
      
      observer.observe(document.body, { 
        childList: true, 
        subtree: true, 
        attributes: true 
      });
    },
    
    // 设置数据上报
    setupReporting() {
      // 页面卸载时发送数据
      window.addEventListener('beforeunload', () => {
        this.sendUsageData();
      });
      
      // 定期发送数据
      setInterval(() => {
        this.sendUsageData();
      }, 30000); // 每30秒发送一次
    },
    
    // 发送使用数据
    sendUsageData() {
      const data = {
        timestamp: Date.now(),
        sessionTime: Date.now() - this.startTime,
        url: window.location.href,
        userAgent: navigator.userAgent,
        usage: {
          components: Array.from(this.usageData.components),
          methods: Array.from(this.usageData.methods),
          computed: Array.from(this.usageData.computed),
          routes: Array.from(this.usageData.routes),
          imports: Array.from(this.usageData.imports),
          events: Array.from(this.usageData.events)
        }
      };
      
      // 发送到本地服务器或存储到 localStorage
      this.storeLocally(data);
    },
    
    // 本地存储数据
    storeLocally(data) {
      try {
        const existing = JSON.parse(localStorage.getItem('__vueUsageData') || '[]');
        existing.push(data);
        
        // 保留最近100条记录
        if (existing.length > 100) {
          existing.splice(0, existing.length - 100);
        }
        
        localStorage.setItem('__vueUsageData', JSON.stringify(existing));
      } catch (e) {
        console.warn('无法存储 Vue 使用数据:', e);
      }
    }
  };
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.__vueUsageTracker.init();
    });
  } else {
    window.__vueUsageTracker.init();
  }
})();
</script>`;
  }

  // 注入跟踪脚本到main.js文件
  injectIntoMainJS(mainJsPath) {
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(`main.js文件不存在: ${mainJsPath}`);
    }

    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
    
    // 检查是否已经注入
    if (mainJsContent.includes('__vueUsageTracker')) {
      console.log('⚠️  跟踪脚本已存在，跳过注入');
      return mainJsPath;
    }

    // 生成简化的跟踪代码
    const trackerCode = this.generateMainJSTracker();
    
    // 分析并修改main.js源码，直接在关键位置插入跟踪
    let modifiedContent = mainJsContent;
    
    // 1. 在createApp调用后立即插入跟踪代码
    const createAppCallRegex = /(const\s+app\s*=\s*createApp\s*\([^)]+\))/g;
    modifiedContent = modifiedContent.replace(createAppCallRegex, (match) => {
      return `${match}
// Vue Usage Tracker - 立即跟踪Vue应用
window.__vueUsageTracker && window.__vueUsageTracker.trackVueApp(app);`;
    });
    
    // 2. 在router创建后插入跟踪代码
    const routerCallRegex = /(const\s+router\s*=\s*createRouter\s*\([^)]+\))/g;
    modifiedContent = modifiedContent.replace(routerCallRegex, (match) => {
      return `${match}
// Vue Usage Tracker - 跟踪路由
window.__vueUsageTracker && window.__vueUsageTracker.trackRouter(router);`;
    });
    
    // 3. 在app.mount之前插入最终跟踪
    const mountCallRegex = /(app\.mount\s*\([^)]+\))/g;
    modifiedContent = modifiedContent.replace(mountCallRegex, (match) => {
      return `// Vue Usage Tracker - 应用挂载前最后检查
window.__vueUsageTracker && window.__vueUsageTracker.finalizeTracking();
${match}`;
    });
    
    // 在文件开头注入跟踪代码
    const injectedContent = `${trackerCode}\n\n${modifiedContent}`;

    // 创建备份
    const backupPath = mainJsPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, mainJsContent);

    // 写入注入后的内容
    fs.writeFileSync(mainJsPath, injectedContent);

    console.log(`✅ 已注入跟踪脚本到: ${mainJsPath}`);
    console.log(`📋 备份文件: ${backupPath}`);
    
    return mainJsPath;
  }

  // 生成适用于main.js的跟踪代码
  generateMainJSTracker() {
    return `// Vue Usage Tracker - 自动运行时使用情况跟踪
(function() {
  console.log('🔍 Vue Usage Tracker starting...');
  
  window.__vueUsageTracker = {
    usageData: {
      components: new Set(),
      methods: new Set(),
      computed: new Set(),
      routes: new Set(),
      imports: new Set(),
      events: new Set()
    },
    startTime: Date.now(),
    
    init() {
      this.usageData.events.add('Tracker initialized at ' + new Date().toISOString());
      this.trackClicks();
      this.trackNavigation();
      this.startDataSaving();
    },
    
    // 跟踪Vue应用实例（由注入的代码调用）
    trackVueApp(app) {
      this.usageData.events.add('Vue app instance captured!');
      
      if (!app) {
        this.usageData.events.add('Warning: app is null or undefined');
        return;
      }
      
      // 记录应用信息
      if (app.version) {
        this.usageData.events.add('Vue version: ' + app.version);
      }
      
      // 拦截插件使用
      if (app.use) {
        const originalUse = app.use;
        app.use = function(plugin, ...options) {
          let pluginName = 'unknown';
          if (plugin && plugin.name) pluginName = plugin.name;
          else if (plugin && plugin.install && plugin.install.name) pluginName = plugin.install.name;
          else if (typeof plugin === 'function' && plugin.name) pluginName = plugin.name;
          
          window.__vueUsageTracker.usageData.events.add('Plugin installed: ' + pluginName);
          return originalUse.call(this, plugin, ...options);
        };
      }
      
      // 拦截组件注册
      if (app.component) {
        const originalComponent = app.component;
        app.component = function(name, component) {
          if (arguments.length === 1) return originalComponent.call(this, name);
          window.__vueUsageTracker.usageData.components.add(name);
          window.__vueUsageTracker.usageData.events.add('Global component registered: ' + name);
          return originalComponent.call(this, name, component);
        };
      }
      
      // 拦截应用挂载
      if (app.mount) {
        const originalMount = app.mount;
        app.mount = function(selector) {
          window.__vueUsageTracker.usageData.events.add('App mounting to: ' + selector);
          const result = originalMount.call(this, selector);
          
          // 挂载后分析DOM
          setTimeout(() => {
            window.__vueUsageTracker.analyzeVueDOM();
          }, 500);
          
          return result;
        };
      }
      
      this.usageData.events.add('Vue app tracking setup completed');
    },
    
    // 跟踪路由实例（由注入的代码调用）
    trackRouter(router) {
      this.usageData.events.add('Router instance captured!');
      
      if (!router) {
        this.usageData.events.add('Warning: router is null or undefined');
        return;
      }
      
      // 拦截路由导航
      ['push', 'replace', 'go', 'back', 'forward'].forEach(method => {
        if (router[method] && typeof router[method] === 'function') {
          const original = router[method];
          router[method] = function(location) {
            let path = '';
            if (typeof location === 'string') {
              path = location;
            } else if (location && location.path) {
              path = location.path;
            } else if (location && location.name) {
              path = 'name:' + location.name;
            }
            
            window.__vueUsageTracker.usageData.routes.add(path);
            window.__vueUsageTracker.usageData.events.add('Navigation: ' + method + ' to ' + path);
            
            return original.apply(this, arguments);
          };
        }
      });
      
      // 监听路由变化
      if (router.afterEach && typeof router.afterEach === 'function') {
        router.afterEach((to, from) => {
          if (to && to.path) {
            this.usageData.routes.add(to.path);
            this.usageData.events.add('Route changed to: ' + to.path);
          }
          if (to && to.name) {
            this.usageData.events.add('Route name: ' + to.name);
          }
        });
      }
      
      this.usageData.events.add('Router tracking setup completed');
    },
    
    // 最终化跟踪（应用挂载前调用）
    finalizeTracking() {
      this.usageData.events.add('Finalizing tracking setup...');
      
      // 记录当前路由
      this.usageData.routes.add(window.location.pathname);
      this.usageData.events.add('Current route: ' + window.location.pathname);
      
      // 立即保存一次数据
      this.saveData();
    },
    
    // 分析Vue DOM结构
    analyzeVueDOM() {
      this.usageData.events.add('Analyzing Vue DOM structure...');
      
      // 统计Vue组件
      const vueElements = document.querySelectorAll('[data-v-]');
      if (vueElements.length > 0) {
        this.usageData.events.add('Found ' + vueElements.length + ' Vue components in DOM');
      }
      
      // 查找Vue指令
      const directives = ['v-if', 'v-for', 'v-show', 'v-model', 'v-on', '@click', '@input'];
      directives.forEach(directive => {
        const elements = document.querySelectorAll('[' + directive + ']');
        if (elements.length > 0) {
          this.usageData.events.add('Directive ' + directive + ': ' + elements.length + ' uses');
        }
      });
      
      // 查找Element Plus组件
      const elementPlusClasses = document.querySelectorAll('[class*="el-"]');
      if (elementPlusClasses.length > 0) {
        this.usageData.events.add('Element Plus components: ' + elementPlusClasses.length + ' instances');
      }
    },
    
    // 拦截Vue相关的import
    patchVueImports() {
      // 由于Vue是通过ES6 import导入的，我们需要拦截模块系统
      // 但是在注入到main.js时，我们需要在Vue导入之前运行
      
      // 尝试劫持import语句的执行
      this.interceptESModules();
      
      // 延迟检测Vue对象
      this.scheduleVueDetection();
    },
    
    // 拦截ES模块加载
    interceptESModules() {
      // 尝试拦截动态import
      if (window.import) {
        const originalImport = window.import;
        window.import = function(specifier) {
          if (specifier.includes('vue')) {
            window.__vueUsageTracker.usageData.events.add('Dynamic import detected: ' + specifier);
          }
          return originalImport.call(this, specifier);
        };
      }
      
      // 监听webpack或vite的模块加载
      if (window.__webpack_require__) {
        this.usageData.events.add('Webpack module system detected');
      }
      
      if (window.__vite__) {
        this.usageData.events.add('Vite module system detected');
      }
    },
    
    // 计划Vue检测
    scheduleVueDetection() {
      // 多次尝试检测，因为Vue可能在不同时间点可用
      const attempts = [100, 500, 1000, 2000, 5000];
      
      attempts.forEach(delay => {
        setTimeout(() => {
          this.detectVueFramework();
          this.detectVueInDOM();
        }, delay);
      });
    },
    
    // 检测Vue框架
    detectVueFramework() {
      // 检查全局Vue对象
      if (typeof Vue !== 'undefined') {
        this.usageData.events.add('Global Vue detected: ' + (Vue.version || 'unknown'));
        this.patchVue(Vue);
      }
      
      if (typeof window.Vue !== 'undefined') {
        this.usageData.events.add('Window Vue detected: ' + (window.Vue.version || 'unknown'));
        this.patchVue(window.Vue);
      }
      
      // 检查DOM中的Vue应用特征
      const vueElements = document.querySelectorAll('[data-v-]');
      if (vueElements.length > 0) {
        this.usageData.events.add('Vue scoped CSS found: ' + vueElements.length + ' elements');
      }
      
      // 检查Vue Router
      if (typeof VueRouter !== 'undefined') {
        this.usageData.events.add('VueRouter global detected');
      }
      
      // 检查已挂载的Vue应用
      const appElements = document.querySelectorAll('#app, [id*="app"], [class*="app"]');
      appElements.forEach((el, index) => {
        if (el.__vue__ || el.__vue_app__) {
          this.usageData.events.add('Vue app instance found in DOM: element ' + (index + 1));
        }
      });
    },
    
    // 专门检测Vue在DOM中的存在
    detectVueInDOM() {
      // 检查Vue 3特有的特征
      const vue3Indicators = [
        '[data-v-]',           // Vue 3 scoped CSS
        '.v-enter',            // Vue transition classes
        '.v-leave', 
        '[v-if]',              // Vue directives
        '[v-for]',
        '[v-show]',
        '[v-model]',
        '[class*="el-"]',      // Element Plus components
        '[class*="ep-"]'       // Element Plus prefixes
      ];
      
      let foundVueFeatures = 0;
      vue3Indicators.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          foundVueFeatures++;
          this.usageData.events.add('Vue feature detected: ' + selector + ' (' + elements.length + ' elements)');
        }
      });
      
      if (foundVueFeatures > 0) {
        this.usageData.events.add('Vue application confirmed by DOM analysis (' + foundVueFeatures + ' indicators)');
        
        // 尝试通过DOM反向工程找到Vue实例
        this.findVueInstancesInDOM();
      }
    },
    
    // 在DOM中查找Vue实例
    findVueInstancesInDOM() {
      const potentialVueElements = document.querySelectorAll('[data-v-], #app, [id*="app"]');
      
      potentialVueElements.forEach((el, index) => {
        // 检查元素的Vue相关属性
        Object.keys(el).forEach(key => {
          if (key.startsWith('__vue') || key.includes('vue')) {
            this.usageData.events.add('Vue property found on DOM element: ' + key);
          }
        });
        
        // 检查元素的事件监听器
        if (el._vei || el.__vueParentComponent) {
          this.usageData.events.add('Vue component data found on element ' + (index + 1));
        }
      });
    },
    
    // 修补Vue对象
    patchVue(vue) {
      if (!vue) return;
      
      // Vue 3 createApp
      if (vue.createApp && typeof vue.createApp === 'function') {
        this.usageData.events.add('Patching Vue 3 createApp');
        const originalCreateApp = vue.createApp;
        vue.createApp = (rootComponent, rootProps) => {
          this.usageData.events.add('Vue 3 app created');
          if (rootComponent && rootComponent.name) {
            this.usageData.components.add(rootComponent.name);
          }
          
          const app = originalCreateApp(rootComponent, rootProps);
          this.patchAppInstance(app);
          return app;
        };
      }
      
      // Vue 2 兼容
      if (vue.prototype && vue.prototype.$mount) {
        this.usageData.events.add('Vue 2 detected, patching prototype');
        const originalMount = vue.prototype.$mount;
        vue.prototype.$mount = function(...args) {
          window.__vueUsageTracker.usageData.events.add('Vue 2 component mounted');
          return originalMount.apply(this, args);
        };
      }
    },
    
    // 修补应用实例
    patchAppInstance(app) {
      if (!app) return;
      
      // 监听插件使用
      if (app.use) {
        const originalUse = app.use;
        app.use = function(plugin, ...options) {
          let pluginName = 'unknown';
          if (plugin && plugin.name) pluginName = plugin.name;
          else if (plugin && plugin.install && plugin.install.name) pluginName = plugin.install.name;
          window.__vueUsageTracker.usageData.events.add('Plugin used: ' + pluginName);
          return originalUse.call(this, plugin, ...options);
        };
      }
      
      // 监听组件注册
      if (app.component) {
        const originalComponent = app.component;
        app.component = function(name, component) {
          if (arguments.length === 1) return originalComponent.call(this, name);
          window.__vueUsageTracker.usageData.components.add(name);
          window.__vueUsageTracker.usageData.events.add('Component registered: ' + name);
          return originalComponent.call(this, name, component);
        };
      }
      
      // 监听应用挂载
      if (app.mount) {
        const originalMount = app.mount;
        app.mount = function(selector) {
          window.__vueUsageTracker.usageData.events.add('App mounted to: ' + selector);
          const result = originalMount.call(this, selector);
          
          // 尝试从挂载后的DOM中获取更多信息
          setTimeout(() => {
            window.__vueUsageTracker.analyzeDOM();
          }, 500);
          
          return result;
        };
      }
    },
    
    // 分析DOM以发现Vue特征
    analyzeDOM() {
      // 查找Vue指令
      const directives = ['v-if', 'v-for', 'v-show', 'v-model', 'v-on', '@click'];
      directives.forEach(directive => {
        const elements = document.querySelectorAll('[' + directive + '], [' + directive.replace('@', 'v-on:') + ']');
        if (elements.length > 0) {
          this.usageData.events.add('Vue directive found: ' + directive + ' (' + elements.length + ' elements)');
        }
      });
      
      // 查找Vue组件特征
      const componentElements = document.querySelectorAll('[class*="el-"], [class*="v-"]');
      if (componentElements.length > 0) {
        this.usageData.events.add('Vue/Element components found: ' + componentElements.length + ' elements');
      }
    },
    
    // 跟踪重要的点击事件
    trackClicks() {
      document.addEventListener('click', (event) => {
        const target = event.target;
        
        // 只记录重要的点击：按钮、链接、表单元素
        const importantTags = ['button', 'a', 'input', 'select', 'textarea'];
        if (!importantTags.includes(target.tagName.toLowerCase())) {
          return;
        }
        
        let identifier = target.tagName.toLowerCase();
        if (target.id) identifier += '#' + target.id;
        if (target.className) identifier += '.' + target.className.split(' ')[0];
        
        this.usageData.events.add('Click: ' + identifier);
      });
    },
    
    // 跟踪导航
    trackNavigation() {
      // 监听路由变化
      ['hashchange', 'popstate'].forEach(event => {
        window.addEventListener(event, () => {
          this.usageData.routes.add(window.location.pathname + window.location.hash);
          this.usageData.events.add('Navigation: ' + event + ' to ' + window.location.pathname);
        });
      });
      
      // 记录当前路由
      this.usageData.routes.add(window.location.pathname);
      this.usageData.events.add('Initial route: ' + window.location.pathname);
    },
    
    // 开始数据保存
    startDataSaving() {
      setInterval(() => this.saveData(), 30000);
      window.addEventListener('beforeunload', () => this.saveData());
    },
    
    // 保存数据
    saveData() {
      const data = {
        timestamp: Date.now(),
        sessionTime: Date.now() - this.startTime,
        url: window.location.href,
        usage: {
          components: Array.from(this.usageData.components),
          methods: Array.from(this.usageData.methods),
          computed: Array.from(this.usageData.computed),
          routes: Array.from(this.usageData.routes),
          imports: Array.from(this.usageData.imports),
          events: Array.from(this.usageData.events)
        }
      };
      
      try {
        const existing = JSON.parse(localStorage.getItem('__vueUsageData') || '[]');
        existing.push(data);
        if (existing.length > 100) existing.splice(0, existing.length - 100);
        localStorage.setItem('__vueUsageData', JSON.stringify(existing));
      } catch (e) {
        console.warn('无法保存Vue使用数据:', e);
      }
    }
  };
  
  // 立即初始化
  window.__vueUsageTracker.init();
  
  console.log('🔍 Vue Usage Tracker initialized and running');
})();`;
  }

  // 分析本地存储的使用数据
  analyzeUsageData(projectDir) {
    console.log('🔍 分析运行时使用数据...');
    console.log('💡 提示: 运行时数据分析需要配合浏览器使用');
    console.log('💡 请在浏览器开发者工具中执行以下命令来查看收集的数据:');
    console.log('');
    console.log('   // 查看所有收集的数据');
    console.log('   JSON.parse(localStorage.getItem("__vueUsageData"))');
    console.log('');
    console.log('   // 查看最新的使用数据');
    console.log('   const data = JSON.parse(localStorage.getItem("__vueUsageData"))');
    console.log('   console.table(data[data.length - 1].usage)');
    console.log('');
    console.log('   // 导出数据到文件');
    console.log('   const blob = new Blob([localStorage.getItem("__vueUsageData")], {type: "application/json"})');
    console.log('   const url = URL.createObjectURL(blob)');
    console.log('   const a = document.createElement("a")');
    console.log('   a.href = url');
    console.log('   a.download = "vue-runtime-data.json"');
    console.log('   a.click()');
    console.log('');
    
    // 创建一个示例分析脚本文件
    const analysisScript = this.generateAnalysisScript();
    const scriptPath = path.join(projectDir, 'analyze-runtime-data.html');
    fs.writeFileSync(scriptPath, analysisScript);
    
    console.log(`📄 已创建运行时数据分析页面: ${scriptPath}`);
    console.log('💡 在浏览器中打开此文件来分析收集的运行时数据');
    
    const analysisResult = {
      totalSessions: 0,
      uniqueComponents: new Set(),
      uniqueMethods: new Set(),
      uniqueRoutes: new Set(),
      sessionData: [],
      analysisPagePath: scriptPath
    };

    return analysisResult;
  }

  // 生成数据分析页面
  generateAnalysisScript() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vue Runtime Data Analysis</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .data-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .data-table th { background-color: #f2f2f2; }
        .stats { display: flex; gap: 20px; }
        .stat-card { padding: 15px; background: #f8f9fa; border-radius: 5px; }
        button { padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .empty-data { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <h1>🔍 Vue Runtime Usage Analysis</h1>
    
    <div class="section">
        <h2>📊 Quick Stats</h2>
        <div class="stats" id="quickStats">
            <div class="stat-card">
                <h3>Sessions</h3>
                <div id="sessionCount">-</div>
            </div>
            <div class="stat-card">
                <h3>Components</h3>
                <div id="componentCount">-</div>
            </div>
            <div class="stat-card">
                <h3>Methods</h3>
                <div id="methodCount">-</div>
            </div>
            <div class="stat-card">
                <h3>Routes</h3>
                <div id="routeCount">-</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>🎛️ Controls</h2>
        <button onclick="loadData()">🔄 Load Data</button>
        <button onclick="exportData()">💾 Export Data</button>
        <button onclick="clearData()">🗑️ Clear Data</button>
    </div>
    
    <div class="section">
        <h2>📈 Usage Summary</h2>
        <div id="usageSummary"></div>
    </div>
    
    <div class="section">
        <h2>📝 Session Details</h2>
        <div id="sessionDetails"></div>
    </div>
    
    <script>
        let runtimeData = [];
        
        function loadData() {
            try {
                const rawData = localStorage.getItem('__vueUsageData');
                if (!rawData) {
                    alert('No runtime data found. Please run your Vue application with tracking enabled first.');
                    return;
                }
                
                runtimeData = JSON.parse(rawData);
                updateStats();
                updateUsageSummary();
                updateSessionDetails();
                
                console.log('Loaded runtime data:', runtimeData);
            } catch (error) {
                alert('Error loading data: ' + error.message);
            }
        }
        
        function updateStats() {
            const sessionCount = runtimeData.length;
            const allComponents = new Set();
            const allMethods = new Set();
            const allRoutes = new Set();
            
            runtimeData.forEach(session => {
                if (session.usage) {
                    session.usage.components?.forEach(c => allComponents.add(c));
                    session.usage.methods?.forEach(m => allMethods.add(m));
                    session.usage.routes?.forEach(r => allRoutes.add(r));
                }
            });
            
            document.getElementById('sessionCount').textContent = sessionCount;
            document.getElementById('componentCount').textContent = allComponents.size;
            document.getElementById('methodCount').textContent = allMethods.size;
            document.getElementById('routeCount').textContent = allRoutes.size;
        }
        
        function updateUsageSummary() {
            const summary = document.getElementById('usageSummary');
            
            if (runtimeData.length === 0) {
                summary.innerHTML = '<div class="empty-data">No data available</div>';
                return;
            }
            
            const latest = runtimeData[runtimeData.length - 1];
            const usage = latest.usage || {};
            
            let html = '<table class="data-table"><tr><th>Category</th><th>Items</th><th>Count</th></tr>';
            
            ['components', 'methods', 'computed', 'routes', 'events'].forEach(category => {
                const items = usage[category] || [];
                html += \`<tr><td>\${category}</td><td>\${items.join(', ') || 'None'}</td><td>\${items.length}</td></tr>\`;
            });
            
            html += '</table>';
            summary.innerHTML = html;
        }
        
        function updateSessionDetails() {
            const details = document.getElementById('sessionDetails');
            
            if (runtimeData.length === 0) {
                details.innerHTML = '<div class="empty-data">No sessions recorded</div>';
                return;
            }
            
            let html = '<table class="data-table"><tr><th>Session</th><th>Duration</th><th>URL</th><th>Events</th></tr>';
            
            runtimeData.forEach((session, index) => {
                const duration = Math.round(session.sessionTime / 1000) + 's';
                const eventCount = session.usage?.events?.length || 0;
                const url = session.url || 'Unknown';
                
                html += \`<tr><td>\${index + 1}</td><td>\${duration}</td><td>\${url}</td><td>\${eventCount}</td></tr>\`;
            });
            
            html += '</table>';
            details.innerHTML = html;
        }
        
        function exportData() {
            if (runtimeData.length === 0) {
                alert('No data to export. Load data first.');
                return;
            }
            
            const blob = new Blob([JSON.stringify(runtimeData, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vue-runtime-data-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        function clearData() {
            if (confirm('Are you sure you want to clear all runtime data?')) {
                localStorage.removeItem('__vueUsageData');
                runtimeData = [];
                updateStats();
                updateUsageSummary();
                updateSessionDetails();
                alert('Data cleared successfully.');
            }
        }
        
        // Auto-load data when page loads
        document.addEventListener('DOMContentLoaded', loadData);
    </script>
</body>
</html>`;
  }

  // 生成使用报告
  generateUsageReport(usageData, projectDir) {
    const reportPath = path.join(projectDir, 'vue-usage-report.json');
    
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalSessions: usageData.sessionData.length,
        uniqueComponents: usageData.uniqueComponents.size,
        uniqueMethods: usageData.uniqueMethods.size,
        uniqueRoutes: usageData.uniqueRoutes.size
      },
      details: usageData
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 使用报告已生成: ${reportPath}`);
    
    return reportPath;
  }
}

module.exports = { VueRuntimeScanner };