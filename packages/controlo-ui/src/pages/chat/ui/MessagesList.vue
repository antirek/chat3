<template>
  <div class="messages-list" ref="messagesContainer">
    <div v-if="loading" class="loading">Загрузка сообщений...</div>
    <div v-else-if="error" class="error">Ошибка: {{ error }}</div>
    <div v-else-if="messages.length === 0" class="empty">Нет сообщений</div>
    <div v-else class="messages">
      <div
        v-for="message in messages"
        :key="message.messageId || message._id"
        :class="['message', { 'message-mine': message.context?.isMine }]"
      >
        <div class="message-bubble">
          <div class="message-sender" v-if="!message.context?.isMine">
            {{ message.senderId }}
          </div>
          <div class="message-content">{{ message.content }}</div>
          <div class="message-footer">
            <span class="message-time">{{ formatTime(message.createdAt) }}</span>
            <span v-if="message.context?.isMine" class="message-status">
              {{ getStatusText(message) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import { formatTimestamp } from '@/shared/lib/utils/date';

interface Props {
  messages: any[];
  loading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
});

const messagesContainer = ref<HTMLElement | null>(null);

function formatTime(timestamp: number | string): string {
  if (!timestamp) return '';
  const ts = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diff / 60000);
  
  // Если меньше минуты - "только что"
  if (diffMinutes < 1) {
    return 'только что';
  }
  
  // Если сегодня - показываем время
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  
  // Если вчера - "вчера, время"
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `вчера, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Иначе - дата и время
  return date.toLocaleString('ru-RU', { 
    day: '2-digit', 
    month: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function getStatusText(message: any): string {
  // Ищем статус для текущего пользователя в statusMessageMatrix
  // Но проще использовать context, если он есть
  // Пока просто возвращаем "отправлено" для своих сообщений
  return '✓';
}

// Автопрокрутка к последнему сообщению при загрузке
async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

watch(() => props.messages.length, () => {
  scrollToBottom();
});

onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.loading,
.error,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.error {
  color: #d32f2f;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  width: 100%;
}

.message-mine {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 18px;
  word-wrap: break-word;
}

.message:not(.message-mine) .message-bubble {
  background: white;
  border-bottom-left-radius: 4px;
  align-self: flex-start;
}

.message-mine .message-bubble {
  background: #0084ff;
  color: white;
  border-bottom-right-radius: 4px;
  align-self: flex-end;
}

.message-sender {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #666;
}

.message-mine .message-sender {
  display: none;
}

.message-content {
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.message-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.7;
}

.message-time {
  font-size: 11px;
}

.message-status {
  font-size: 12px;
}
</style>
