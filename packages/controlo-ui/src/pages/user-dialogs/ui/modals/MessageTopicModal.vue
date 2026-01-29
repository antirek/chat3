<template>
  <BaseModal :is-open="isOpen" title="📌 Топик сообщения" max-width="500px" @close="$emit('close')">
    <div v-if="messageId" class="message-id-info">{{ messageId }}</div>

    <div v-if="currentTopicId" class="topic-section">
      <p class="topic-label">Текущий топик:</p>
      <div class="topic-id-value">{{ currentTopicId }}</div>
      <BaseButton variant="danger" size="small" :disabled="loading" @click="$emit('clear')">
        Сбросить
      </BaseButton>
    </div>

    <div v-else class="topic-section">
      <p class="topic-label">У сообщения нет топика. Выберите топик диалога:</p>
      <select
        v-model="selectedTopicId"
        class="topic-select"
        :disabled="loading || !dialogTopics.length"
      >
        <option value="">-- Выберите топик --</option>
        <option v-for="topic in dialogTopics" :key="topic.topicId" :value="topic.topicId">
          {{ topic.topicId }}{{ topic.meta && Object.keys(topic.meta).length > 0 ? ` (${Object.entries(topic.meta).map(([k, v]) => `${k}:${v}`).join(', ')})` : '' }}
        </option>
      </select>
      <BaseButton
        variant="primary"
        size="small"
        :disabled="loading || !selectedTopicId"
        @click="$emit('set', selectedTopicId)"
      >
        Установить
      </BaseButton>
    </div>

    <div v-if="loading" class="loading-hint">Запрос...</div>
    <div v-if="error" class="error-message">{{ error }}</div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface Topic {
  topicId: string;
  meta?: Record<string, unknown>;
}

interface Props {
  isOpen: boolean;
  messageId: string | null;
  currentTopicId: string | null;
  dialogTopics: Topic[];
  loading?: boolean;
  error?: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'clear'): void;
  (e: 'set', topicId: string): void;
}>();

const selectedTopicId = ref('');

watch(
  () => [props.isOpen, props.dialogTopics],
  () => {
    selectedTopicId.value = '';
  },
  { immediate: true }
);
</script>

<style scoped>
.message-id-info {
  margin-bottom: 12px;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  color: #495057;
}

.topic-section {
  margin-bottom: 16px;
}

.topic-label {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}

.topic-id-value {
  margin-bottom: 10px;
  padding: 8px;
  background: #e7f3ff;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  word-break: break-all;
}

.topic-select {
  display: block;
  width: 100%;
  max-width: 100%;
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.loading-hint {
  color: #6c757d;
  font-size: 13px;
  margin-top: 8px;
}

.error-message {
  margin-top: 10px;
  padding: 8px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 13px;
}
</style>
