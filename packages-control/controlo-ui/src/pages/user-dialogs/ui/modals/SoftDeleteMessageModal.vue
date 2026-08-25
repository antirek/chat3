<template>
  <BaseModal
    :is-open="isOpen"
    :title="deleted ? '♻️ Восстановить сообщение' : '🗑️ Удалить сообщение'"
    max-width="520px"
    @close="$emit('close')"
  >
    <div v-if="messageId" class="message-id-info">{{ messageId }}</div>

    <div class="preview">
      <p class="preview-label">Содержимое:</p>
      <div class="preview-content" :class="{ struck: deleted }">{{ content || '—' }}</div>
    </div>

    <div v-if="deleted" class="state-banner deleted">
      Soft-deleted
      <span v-if="deletedAt != null"> · {{ formatTimestamp(deletedAt) }}</span>
      <span v-if="deletedBy"> · {{ deletedBy }}</span>
    </div>
    <div v-else class="state-banner">
      Сообщение будет помечено удалённым (soft-delete). Content сохранится; правки и реакции останутся доступны.
    </div>

    <div v-if="!deleted" class="form-group">
      <label for="softDeleteBy">deletedBy (необязательно)</label>
      <input
        id="softDeleteBy"
        type="text"
        :value="deletedByInput"
        placeholder="кто удаляет"
        @input="$emit('update:deletedByInput', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div v-if="loading" class="hint">Запрос…</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <template #footer>
      <BaseButton variant="secondary" :disabled="loading" @click="$emit('close')">Отмена</BaseButton>
      <BaseButton
        v-if="deleted"
        variant="primary"
        :disabled="loading"
        @click="$emit('submit')"
      >
        Восстановить
      </BaseButton>
      <BaseButton
        v-else
        variant="danger"
        :disabled="loading"
        @click="$emit('submit')"
      >
        Удалить
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';
import { formatTimestamp } from '@/shared/lib/utils/date';

interface Props {
  isOpen: boolean;
  messageId: string | null;
  content: string;
  deleted: boolean;
  deletedAt?: number | null;
  deletedBy?: string | null;
  deletedByInput: string;
  loading?: boolean;
  error?: string | null;
}

withDefaults(defineProps<Props>(), {
  deletedAt: null,
  deletedBy: null,
  loading: false,
  error: null,
});

defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:deletedByInput', value: string): void;
}>();
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

.preview {
  margin-bottom: 12px;
}

.preview-label {
  font-size: 13px;
  color: #6c757d;
  margin: 0 0 6px;
}

.preview-content {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 160px;
  overflow: auto;
}

.preview-content.struck {
  text-decoration: line-through;
  color: #6c757d;
}

.state-banner {
  margin-bottom: 14px;
  padding: 8px 10px;
  background: #e7f3ff;
  border-radius: 4px;
  font-size: 13px;
  color: #0c5460;
}

.state-banner.deleted {
  background: #f8d7da;
  color: #721c24;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}

.form-group input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.hint {
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
