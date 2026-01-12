<template>
  <div id="app">
    <AppLayout />
  </div>
</template>

<script setup lang="ts">
import { AppLayout } from '@/widgets/app-layout';
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

#app {
  height: 100vh;
  overflow: hidden;
}
</style>
