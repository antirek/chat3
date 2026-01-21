<template>
  <div v-if="stats" class="user-stats">
    <span class="stat-item">
      <span class="stat-label">Диалоги:</span>
      <span class="stat-value">{{ stats.dialogCount }}</span>
    </span>
    <span class="stat-separator">•</span>
    <span class="stat-item">
      <span class="stat-label">Непрочитанные диалоги:</span>
      <span class="stat-value">{{ stats.unreadDialogsCount }}</span>
    </span>
    <span class="stat-separator">•</span>
    <span class="stat-item">
      <span class="stat-label">Сообщения:</span>
      <span class="stat-value">{{ stats.totalMessagesCount }}</span>
    </span>
    <span class="stat-separator">•</span>
    <span class="stat-item">
      <span class="stat-label">Непрочитанные сообщения:</span>
      <span class="stat-value">{{ stats.totalUnreadCount }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  stats: {
    dialogCount: number;
    unreadDialogsCount: number;
    totalMessagesCount: number;
    totalUnreadCount: number;
  } | null;
}

defineProps<Props>();
</script>

<style scoped>
.user-stats {
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
