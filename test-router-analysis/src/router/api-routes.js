import { createRouter, createWebHistory } from 'vue-router'

// API专用路由 - 这些路由可能通过外部API调用访问
const apiRoutes = [
  {
    path: '/api/health',
    name: 'api-health',
    component: () => import('@/views/api/HealthCheck.vue')
  },
  {
    path: '/api/status', 
    name: 'api-status',
    component: () => import('@/views/api/StatusPage.vue')
  },
  {
    path: '/webhook/callback',
    name: 'webhook-callback',
    component: () => import('@/views/api/WebhookHandler.vue')
  }
]

const apiRouter = createRouter({
  history: createWebHistory(),
  routes: apiRoutes
})

export default apiRouter