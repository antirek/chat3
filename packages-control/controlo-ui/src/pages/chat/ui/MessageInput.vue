<template>
  <div class="message-input">
    <div v-if="error" class="error">{{ error }}</div>
    <div class="input-container">
      <textarea
        v-model="messageText"
        :disabled="sending || !enabled"
        :placeholder="enabled ? 'Введите сообщение...' : 'Сначала выберите диалог'"
        @keydown="handleKeyPress"
        rows="1"
        ref="textareaRef"
      ></textarea>
      <button
        :disabled="sending || !enabled || !messageText.trim()"
        @click="handleSend"
        class="send-button"
      >
        {{ sending ? '...' : 'Отправить' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  messageText: string;
  sending?: boolean;
  error?: string | null;
  enabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  sending: false,
  error: null,
  enabled: false,
});

const emit = defineEmits<{
  'update:messageText': [value: string];
  'send': [];
  'keypress': [event: KeyboardEvent];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

const messageText = ref(props.messageText);

watch(() => props.messageText, (newValue) => {
  messageText.value = newValue;
});

watch(messageText, (newValue) => {
  emit('update:messageText', newValue);
  
  // Автоматическое изменение высоты textarea
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`;
  }
});

function handleSend() {
  if (messageText.value.trim() && !props.sending && props.enabled) {
    emit('send');
  }
}

function handleKeyPress(event: KeyboardEvent) {
  emit('keypress', event);
}
</script>

<style scoped>
.message-input {
  padding: 16px;
  background: white;
  border-top: 1px solid #e9ecef;
}

.error {
  color: #d32f2f;
  font-size: 12px;
  margin-bottom: 8px;
}

.input-container {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.message-input textarea {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  min-height: 40px;
  max-height: 120px;
  overflow-y: auto;
}

.message-input textarea:focus {
  outline: none;
  border-color: #0084ff;
}

.message-input textarea:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-button {
  padding: 10px 20px;
  background: #0084ff;
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.send-button:hover:not(:disabled) {
  background: #0066cc;
}

.send-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
