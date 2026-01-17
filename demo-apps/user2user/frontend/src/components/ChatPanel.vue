<template>
  <div class="chat-panel">
    <div class="chat-header">
      <h3>{{ title }}</h3>
      <div class="connection-status" :class="{ connected: wsConnected }">
        {{ wsConnected ? '● Connected' : '○ Disconnected' }}
      </div>
    </div>
    <MessageList :messages="messages" :current-user-id="userId" />
    <MessageInput @send="handleSend" :disabled="!wsConnected || !dialogId" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MessageList from './MessageList.vue';
import MessageInput from './MessageInput.vue';
import type { Message } from '../types/index.js';

const props = defineProps<{
  userId: string;
  title: string;
  messages: Message[];
  wsConnected: boolean;
  dialogId: string | null;
}>();

const emit = defineEmits<{
  (e: 'send', message: string): void;
}>();

const handleSend = (message: string) => {
  if (props.wsConnected && props.dialogId) {
    emit('send', message);
  }
};
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  border-radius: 8px 8px 0 0;
}

.chat-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.connection-status {
  font-size: 12px;
  color: #dc3545;
}

.connection-status.connected {
  color: #28a745;
}
</style>
