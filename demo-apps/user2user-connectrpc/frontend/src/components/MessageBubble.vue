<template>
  <div :class="['message-bubble', { 'message-sent': isSent, 'message-received': !isSent }]">
    <div class="message-header">
      <span class="message-sender">{{ message.sender_id }}</span>
      <span class="message-time">{{ formattedTime }}</span>
    </div>
    <div class="message-content">{{ message.content }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Message } from '../types/index.js';

const props = defineProps<{
  message: Message;
  currentUserId: string;
}>();

const isSent = computed(() => props.message.sender_id === props.currentUserId);

const formattedTime = computed(() => {
  const date = new Date(props.message.created_at);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
});
</script>

<style scoped>
.message-bubble {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 8px;
  max-width: 70%;
  word-wrap: break-word;
}

.message-sent {
  background: #007bff;
  color: white;
  margin-left: auto;
  text-align: right;
}

.message-received {
  background: #e9ecef;
  color: #333;
  margin-right: auto;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  font-size: 12px;
  opacity: 0.8;
}

.message-sender {
  font-weight: 600;
}

.message-time {
  font-size: 11px;
}

.message-content {
  font-size: 14px;
  line-height: 1.4;
}
</style>
