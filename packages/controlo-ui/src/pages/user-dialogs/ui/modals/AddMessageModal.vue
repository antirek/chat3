<template>
  <BaseModal :is-open="isOpen" :title="modalTitle" max-width="900px" @close="close">
    <div class="modal-form-container">
      <div class="modal-form-left">
        <form @submit.prevent="submit">
          <div class="form-group">
            <label for="messageSender">Отправитель:</label>
            <select id="messageSender" :value="sender" required @change="(e) => emit('update:sender', (e.target as HTMLSelectElement).value)">
              <option value="carl">Carl</option>
              <option value="marta">Marta</option>
              <option value="sara">Sara</option>
              <option value="kirk">Kirk</option>
              <option value="john">John</option>
            </select>
          </div>
          <div class="form-group">
            <label for="messageType">Тип сообщения:</label>
            <select id="messageType" :value="type" required @change="(e) => emit('update:type', (e.target as HTMLSelectElement).value)">
              <option value="internal.text">Text</option>
              <option value="system.message">System</option>
            </select>
          </div>
          <div class="form-group">
            <label for="messageTopicId">Топик (необязательно):</label>
            <select id="messageTopicId" :value="topicId" @change="(e) => emit('update:topicId', (e.target as HTMLSelectElement).value)">
              <option value="">-- Без топика --</option>
              <option v-for="topic in availableTopics" :key="topic.topicId" :value="topic.topicId">
                {{ topic.topicId }}{{ topic.meta && Object.keys(topic.meta).length > 0 ? ` (${Object.entries(topic.meta).map(([k, v]) => `${k}:${v}`).join(', ')})` : '' }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="messageContent">Содержимое:</label>
            <textarea id="messageContent" :value="content" rows="4" required @input="(e) => emit('update:content', (e.target as HTMLTextAreaElement).value)">тест тест</textarea>
          </div>
          <div class="form-group">
            <label for="quotedMessageId">Quoted Message ID:</label>
            <input type="text" id="quotedMessageId" :value="quotedMessageId" placeholder="msg_..." @input="(e) => emit('update:quotedMessageId', (e.target as HTMLInputElement).value)" />
          </div>
          
          <div class="form-group">
            <label>Мета-теги:</label>
            <div class="meta-tags-container">
              <div v-for="(metaTag, index) in metaTags" :key="index" class="meta-tag-row">
                <input type="text" :value="metaTag.key" placeholder="Ключ" @input="(e) => updateMetaTagKey(index, (e.target as HTMLInputElement).value)" />
                <input type="text" :value="metaTag.value" placeholder="Значение" @input="(e) => updateMetaTagValue(index, (e.target as HTMLInputElement).value)" />
                <button type="button" class="btn-remove" @click="removeMetaTag(index)" v-show="metaTags.length > 1">✕</button>
              </div>
            </div>
            <button type="button" class="btn-add" @click="addMetaTag">➕ Добавить мета-тег</button>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-success">Добавить</button>
            <button type="button" class="btn-secondary" @click="close">Отмена</button>
          </div>
        </form>
      </div>
      <div class="modal-form-right">
        <div class="payload-preview">
          <label>JSON Payload:</label>
          <pre class="payload-json">{{ payloadJson }}</pre>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseModal } from '@/shared/ui';

interface MetaTag { key: string; value: string; }
interface Topic { topicId: string; meta?: Record<string, any>; }

interface Props {
  isOpen: boolean;
  currentDialogId: string | null;
  sender: string;
  type: string;
  topicId: string;
  content: string;
  quotedMessageId: string;
  metaTags: MetaTag[];
  availableTopics: Topic[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:sender', value: string): void;
  (e: 'update:type', value: string): void;
  (e: 'update:topicId', value: string): void;
  (e: 'update:content', value: string): void;
  (e: 'update:quotedMessageId', value: string): void;
  (e: 'update:metaTags', value: MetaTag[]): void;
  (e: 'add-meta-tag'): void;
  (e: 'remove-meta-tag', index: number): void;
  (e: 'submit'): void;
}>();

const modalTitle = computed(() => 
  props.currentDialogId ? `Добавить сообщение в "${props.currentDialogId}"` : 'Добавить сообщение'
);

const payloadJson = computed(() => {
  const payload: any = { senderId: props.sender, type: props.type, content: props.content };
  if (props.topicId) payload.topicId = props.topicId;
  if (props.quotedMessageId) payload.quotedMessageId = props.quotedMessageId;
  if (props.metaTags.length > 0) {
    const meta: Record<string, any> = {};
    props.metaTags.forEach((tag) => {
      if (tag.key && tag.value) {
        try { meta[tag.key] = JSON.parse(tag.value); } catch { meta[tag.key] = tag.value; }
      }
    });
    if (Object.keys(meta).length > 0) payload.meta = meta;
  }
  return JSON.stringify(payload, null, 2);
});

function close() { emit('close'); }
function updateMetaTagKey(index: number, value: string) {
  const updated = [...props.metaTags];
  updated[index] = { ...updated[index], key: value };
  emit('update:metaTags', updated);
}
function updateMetaTagValue(index: number, value: string) {
  const updated = [...props.metaTags];
  updated[index] = { ...updated[index], value };
  emit('update:metaTags', updated);
}
function addMetaTag() { emit('add-meta-tag'); }
function removeMetaTag(index: number) { emit('remove-meta-tag', index); }
function submit() { emit('submit'); }
</script>

<style scoped>
.modal-form-container {
  display: flex;
  gap: 20px;
}

.modal-form-left, .modal-form-right {
  flex: 1;
  min-width: 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-group select,
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.meta-tags-container {
  margin-bottom: 10px;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
}

.btn-remove {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-add {
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 15px;
}

.btn-success {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.payload-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
}

.payload-json {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  background: white;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}
</style>
