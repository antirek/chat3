<template>
  <div class="message-list" ref="messageListRef">
    <MessageBubble
      v-for="message in messages"
      :key="message.message_id"
      :message="message"
      :current-user-id="currentUserId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import MessageBubble from './MessageBubble.vue';
import type { Message } from '../types/index.js';

const props = defineProps<{
  messages: Message[];
  currentUserId: string;
}>();

const messageListRef = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
};

// Прокручиваем вниз при изменении количества сообщений или самих сообщений
watch(() => props.messages.length, () => {
  scrollToBottom();
});

watch(() => props.messages, () => {
  scrollToBottom();
}, { deep: true });

onMounted(() => {
  scrollToBottom();
});
</script>

<style scoped>
.message-list {
  flex: 1 1 auto; /* flex-grow: 1, flex-shrink: 1, flex-basis: auto */
  min-height: 0; /* Важно для flex-контейнера с overflow */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message-list::-webkit-scrollbar {
  width: 6px;
}

.message-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.message-list::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.message-list::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
