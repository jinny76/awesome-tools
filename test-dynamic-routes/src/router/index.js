import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // 静态路由
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue')
  },
  
  // 单参数动态路由
  {
    path: '/user/:id',
    name: 'user-profile', 
    component: () => import('@/views/UserProfile.vue')
  },
  
  // 多参数动态路由
  {
    path: '/mobile/:departmentId/:apiCode/:apiSecret',
    name: 'mobile-api',
    component: () => import('@/views/MobileAPI.vue')
  },
  
  // 可选参数路由
  {
    path: '/docs/:category?/:subcategory?',
    name: 'documentation',
    component: () => import('@/views/Documentation.vue')
  },
  
  // 通配符路由
  {
    path: '/files/:pathMatch(.*)*',
    name: 'file-browser',
    component: () => import('@/views/FileBrowser.vue')
  },
  
  // 未使用的动态路由
  {
    path: '/admin/:section/:action',
    name: 'admin-action',
    component: () => import('@/views/AdminAction.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router