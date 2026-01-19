<template>
  <div class="message-input">
    <input
      v-model="messageText"
      type="text"
      placeholder="Type a message..."
      @keyup.enter="handleSend"
      :disabled="disabled"
    />
    <button @click="handleSend" :disabled="disabled || !messageText.trim()">
      Send
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', message: string): void;
}>();

const messageText = ref('');

const handleSend = () => {
  if (!messageText.value.trim() || props.disabled) {
    return;
  }
  emit('send', messageText.value.trim());
  messageText.value = '';
};
</script>

<style scoped>
.message-input {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: white;
  border-top: 1px solid #ddd;
  flex-shrink: 0; /* Предотвращает сжатие поля ввода */
}

.message-input input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.message-input input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.message-input button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.message-input button:hover:not(:disabled) {
  background: #0056b3;
}

.message-input button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
