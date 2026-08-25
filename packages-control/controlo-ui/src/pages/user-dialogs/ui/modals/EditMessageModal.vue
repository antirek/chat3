<template>
  <BaseModal :is-open="isOpen" title="✏️ Редактировать сообщение" max-width="640px" @close="$emit('close')">
    <div v-if="messageId" class="message-id-info">{{ messageId }}</div>

    <div v-if="edited" class="edited-banner">
      Уже редактировалось
      <span v-if="editedAt != null"> · {{ formatTimestamp(editedAt) }}</span>
      <span v-if="editedBy"> · {{ editedBy }}</span>
    </div>

    <form @submit.prevent="$emit('submit')">
      <div class="form-group">
        <label for="editMessageContent">Содержимое</label>
        <textarea
          id="editMessageContent"
          :value="content"
          rows="5"
          required
          @input="$emit('update:content', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
      <div class="form-group">
        <label for="editMessageEditedBy">editedBy (необязательно)</label>
        <input
          id="editMessageEditedBy"
          type="text"
          :value="editedByInput"
          placeholder="кто правит"
          @input="$emit('update:editedByInput', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </form>

    <div v-if="loadingVersions" class="hint">Загрузка версий…</div>
    <div v-else-if="versions.length" class="versions">
      <p class="versions-title">Предыдущие версии (до 20)</p>
      <ul>
        <li v-for="v in versions" :key="v.versionIndex">
          <span class="ver-idx">#{{ v.versionIndex }}</span>
          <span class="ver-time">{{ formatTimestamp(v.createdAt) }}</span>
          <span v-if="v.editedBy" class="ver-by">{{ v.editedBy }}</span>
          <div class="ver-content">{{ v.content }}</div>
        </li>
      </ul>
    </div>

    <div v-if="loading" class="hint">Сохранение…</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <template #footer>
      <BaseButton variant="secondary" :disabled="loading" @click="$emit('close')">Отмена</BaseButton>
      <BaseButton variant="primary" :disabled="loading || !content.trim()" @click="$emit('submit')">
        Сохранить
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';
import { formatTimestamp } from '@/shared/lib/utils/date';

export interface MessageVersionRow {
  versionIndex: number;
  content: string;
  editedBy?: string | null;
  createdAt: number;
}

interface Props {
  isOpen: boolean;
  messageId: string | null;
  content: string;
  editedByInput: string;
  edited?: boolean;
  editedAt?: number | null;
  editedBy?: string | null;
  versions?: MessageVersionRow[];
  loadingVersions?: boolean;
  loading?: boolean;
  error?: string | null;
}

withDefaults(defineProps<Props>(), {
  edited: false,
  editedAt: null,
  editedBy: null,
  versions: () => [],
  loadingVersions: false,
  loading: false,
  error: null,
});

defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:content', value: string): void;
  (e: 'update:editedByInput', value: string): void;
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

.edited-banner {
  margin-bottom: 12px;
  padding: 8px 10px;
  background: #fff3cd;
  border-radius: 4px;
  font-size: 13px;
  color: #856404;
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

.form-group textarea,
.form-group input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.versions {
  margin-top: 16px;
  border-top: 1px solid #e9ecef;
  padding-top: 12px;
  max-height: 220px;
  overflow: auto;
}

.versions-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #495057;
}

.versions ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.versions li {
  padding: 8px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
}

.ver-idx {
  font-weight: 600;
  margin-right: 8px;
}

.ver-time {
  color: #6c757d;
  margin-right: 8px;
}

.ver-by {
  color: #0d6efd;
}

.ver-content {
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #212529;
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
