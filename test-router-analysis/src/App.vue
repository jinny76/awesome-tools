<template>
  <div id="app">
    <nav>
      <!-- 使用的路由 -->
      <router-link to="/">Home</router-link>
      <router-link to="/about">About</router-link>
      <router-link :to="{ name: 'profile' }">Profile</router-link>
      
      <!-- 编程式导航 -->
      <button @click="goToSettings">Settings</button>
      <button @click="$router.push('/admin')">Admin</button>
    </nav>
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'App',
  methods: {
    goToSettings() {
      this.$router.push({ name: 'settings' })
    }
  }
}
</script>