// Vue Usage Tracker - 自动运行时使用情况跟踪
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
      
      return app;
    },
    
    // 跟踪点击事件
    trackClicks() {
      document.addEventListener('click', (event) => {
        const target = event.target;
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
})();

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
// Vue Usage Tracker - 立即跟踪Vue应用
window.__vueUsageTracker && window.__vueUsageTracker.trackVueApp(app);

app.use(router)
app.mount('#app')

// Vue Usage Tracker - 挂载后分析DOM
setTimeout(() => {
  if (window.__vueUsageTracker) {
    // 分析Vue DOM结构
    window.__vueUsageTracker.usageData.events.add('Analyzing Vue DOM structure...');
    
    // 统计Vue组件
    const vueElements = document.querySelectorAll('[data-v-]');
    if (vueElements.length > 0) {
      window.__vueUsageTracker.usageData.events.add('Found ' + vueElements.length + ' Vue components in DOM');
    }
    
    // 查找Vue指令
    const directives = ['v-if', 'v-for', 'v-show', 'v-model', 'v-on', '@click', '@input'];
    directives.forEach(directive => {
      const elements = document.querySelectorAll('[' + directive + ']');
      if (elements.length > 0) {
        window.__vueUsageTracker.usageData.events.add('Directive ' + directive + ': ' + elements.length + ' uses');
      }
    });
    
    // 查找Element Plus组件
    const elementPlusClasses = document.querySelectorAll('[class*="el-"]');
    if (elementPlusClasses.length > 0) {
      window.__vueUsageTracker.usageData.events.add('Element Plus components: ' + elementPlusClasses.length + ' instances');
    }
    
    // 立即保存数据
    window.__vueUsageTracker.saveData();
  }
}, 1000);