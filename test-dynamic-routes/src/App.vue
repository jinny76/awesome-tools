<template>
  <div id="app">
    <nav>
      <!-- 静态路由 -->
      <router-link to="/">Home</router-link>
      
      <!-- 单参数动态路由 - 直接拼接 -->
      <router-link :to="`/user/${userId}`">User Profile</router-link>
      
      <!-- 多参数动态路由 - 使用变量拼接 -->
      <button @click="goToMobileAPI">Mobile API</button>
      
      <!-- 可选参数路由 - 部分参数 -->
      <router-link to="/docs/getting-started">Documentation</router-link>
      
      <!-- 通配符路由 - 文件路径 -->
      <router-link :to="filePath">Browse Files</router-link>
    </nav>
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      userId: 123,
      departmentId: 'dept001',
      apiCode: 'mobile_v2',
      apiSecret: 'secret123',
      filePath: '/files/documents/reports/annual.pdf'
    }
  },
  methods: {
    goToMobileAPI() {
      // 动态拼接多参数路由
      const path = `/mobile/${this.departmentId}/${this.apiCode}/${this.apiSecret}`
      this.$router.push(path)
    },
    
    navigateToUser() {
      // 另一种动态路由导航
      this.$router.push(`/user/${this.getCurrentUserId()}`)
    },
    
    openFileManager() {
      // 动态生成文件路径
      const folder = this.getCurrentFolder()
      const filename = this.getSelectedFile()
      this.$router.push(`/files/${folder}/${filename}`)
    },
    
    getCurrentUserId() {
      return Math.floor(Math.random() * 1000)
    },
    
    getCurrentFolder() {
      return 'uploads'
    },
    
    getSelectedFile() {
      return 'document.pdf'
    }
  }
}
</script>