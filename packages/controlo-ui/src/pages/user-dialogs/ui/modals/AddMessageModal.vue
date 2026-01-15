<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Добавить сообщение{{ currentDialogId ? ` в "${currentDialogId}"` : '' }}</h2>
        <span class="close" @click="close">&times;</span>
      </div>
      <div class="modal-body">
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
              
              <!-- Секция мета-тегов -->
              <div class="form-group">
                <label>Мета-теги:</label>
                <div id="metaTagsContainer">
                  <div
                    v-for="(metaTag, index) in metaTags"
                    :key="index"
                    class="meta-tag-row"
                  >
                    <input
                      type="text"
                      class="meta-key"
                      :value="metaTag.key"
                      placeholder="Ключ (например: channelType)"
                      pattern="[a-zA-Z0-9_]+"
                      title="Только латинские буквы, цифры и подчеркивание"
                      @input="(e) => updateMetaTagKey(index, (e.target as HTMLInputElement).value)"
                    />
                    <input
                      type="text"
                      class="meta-value"
                      :value="metaTag.value"
                      placeholder="Значение (например: whatsapp)"
                      @input="(e) => updateMetaTagValue(index, (e.target as HTMLInputElement).value)"
                    />
                    <button
                      type="button"
                      class="remove-meta-btn"
                      @click="removeMetaTag(index)"
                      v-show="metaTags.length > 1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <button type="button" @click="addMetaTag" class="add-meta-btn">➕ Добавить мета-тег</button>
              </div>
              
              <div class="form-actions">
                <button type="submit" class="btn-success">Добавить</button>
                <button type="button" class="btn-secondary" @click="close">Отмена</button>
              </div>
            </form>
          </div>
          <div class="modal-form-right">
            <!-- Отображение JSON payload -->
            <div class="payload-preview">
              <label>JSON Payload:</label>
              <div id="payloadJson" class="payload-json">{{ payloadJson }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface MetaTag {
  key: string;
  value: string;
}

interface Topic {
  topicId: string;
  meta?: Record<string, any>;
}

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

interface Emits {
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
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const payloadJson = computed(() => {
  const payload: any = {
    senderId: props.sender,
    type: props.type,
    content: props.content,
  };

  if (props.topicId) {
    payload.topicId = props.topicId;
  }

  if (props.quotedMessageId) {
    payload.quotedMessageId = props.quotedMessageId;
  }

  if (props.metaTags.length > 0) {
    const meta: Record<string, any> = {};
    props.metaTags.forEach((tag) => {
      if (tag.key && tag.value) {
        try {
          meta[tag.key] = JSON.parse(tag.value);
        } catch {
          meta[tag.key] = tag.value;
        }
      }
    });
    if (Object.keys(meta).length > 0) {
      payload.meta = meta;
    }
  }

  return JSON.stringify(payload, null, 2);
});

function close() {
  emit('close');
}

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

function addMetaTag() {
  emit('add-meta-tag');
}

function removeMetaTag(index: number) {
  emit('remove-meta-tag', index);
}

function submit() {
  emit('submit');
}
</script>

<style scoped>
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  background-color: #fefefe;
  margin: 3% auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  background: #f8f9fa;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.modal-form-container {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.modal-form-left {
  flex: 1;
  min-width: 0;
}

.modal-form-right {
  flex: 1;
  min-width: 0;
  position: sticky;
  top: 0;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
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

.meta-tag-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.remove-meta-btn {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.remove-meta-btn:hover {
  background: #c82333;
}

.add-meta-btn {
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 10px;
}

.add-meta-btn:hover {
  background: #218838;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.payload-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
}

.payload-json {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: white;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}
</style>
