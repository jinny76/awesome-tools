<template>
  <div>
    <h1>Admin Panel</h1>
    <nav>
      <router-link to="/admin/users">Users</router-link>
      <!-- reports 路由没有在任何地方被引用 -->
    </nav>
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'AdminPanel'
}
</script>