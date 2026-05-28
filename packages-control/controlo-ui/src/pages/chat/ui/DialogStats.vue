<template>
  <div v-if="stats" class="dialog-stats">
    <span class="stat-item">
      <span class="stat-label">Участники:</span>
      <span class="stat-value">{{ stats.memberCount }}</span>
    </span>
    <span class="stat-separator">•</span>
    <span class="stat-item">
      <span class="stat-label">Сообщения:</span>
      <span class="stat-value">{{ stats.messageCount }}</span>
    </span>
    <span class="stat-separator">•</span>
    <span class="stat-item">
      <span class="stat-label">Топики:</span>
      <span class="stat-value">{{ stats.topicCount }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  stats: {
    memberCount: number;
    messageCount: number;
    topicCount: number;
  } | null;
}

defineProps<Props>();
</script>

<style scoped>
.dialog-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
  padding: 8px 0;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  color: #666;
}

.stat-value {
  font-weight: 600;
  color: #333;
}

.stat-separator {
  color: #ccc;
  font-weight: 300;
}
</style>
