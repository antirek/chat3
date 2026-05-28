<template>
  <BaseModal :is-open="isOpen" title="Создать пак" max-width="640px" @close="close">
    <p class="hint">Будет создан новый пак без диалогов. Диалоги можно добавить после создания.</p>

    <div class="meta-section">
      <h3>🏷️ Meta теги</h3>
      <p class="meta-hint">
        Если для паков зарегистрирован <code>required</code>-индекс (например <code>contactId</code>),
        укажите обязательные ключи до создания.
      </p>
      <div v-if="metaTags.length === 0" class="no-tags">Мета-теги не добавлены</div>
      <table v-else class="meta-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tag in metaTags" :key="tag.key">
            <td><strong>{{ tag.key }}</strong></td>
            <td>{{ JSON.stringify(tag.value) }}</td>
            <td>
              <BaseButton type="button" variant="danger" size="small" @click="removeMetaTag(tag.key)">
                🗑️
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="meta-tag-row">
        <input
          type="text"
          v-model="localMetaKey"
          placeholder="key (например: contactId)"
          @keydown.enter.prevent="addMetaTag"
        />
        <input
          type="text"
          v-model="localMetaValue"
          placeholder='value (например: "c_123" или 42)'
          @keydown.enter.prevent="addMetaTag"
        />
        <BaseButton type="button" variant="success" size="small" @click="addMetaTag">➕ Добавить</BaseButton>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="close">Отмена</BaseButton>
      <BaseButton variant="success" :disabled="submitting" @click="handleSubmit">
        {{ submitting ? 'Создание…' : 'Создать' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface MetaTagRow {
  key: string;
  value: unknown;
}

interface Props {
  isOpen: boolean;
  metaTags: MetaTagRow[];
  newMetaKey: string;
  newMetaValue: string;
  submitting?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  submitting: false
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'add-meta-tag'): void;
  (e: 'remove-meta-tag', key: string): void;
  (e: 'update:newMetaKey', value: string): void;
  (e: 'update:newMetaValue', value: string): void;
}>();

const localMetaKey = ref(props.newMetaKey);
const localMetaValue = ref(props.newMetaValue);

watch(() => props.newMetaKey, (val) => { localMetaKey.value = val; });
watch(() => props.newMetaValue, (val) => { localMetaValue.value = val; });
watch(localMetaKey, (val) => { emit('update:newMetaKey', val); });
watch(localMetaValue, (val) => { emit('update:newMetaValue', val); });

function close() {
  emit('close');
}

function handleSubmit() {
  emit('submit');
}

function addMetaTag() {
  emit('add-meta-tag');
}

function removeMetaTag(key: string) {
  emit('remove-meta-tag', key);
}
</script>

<style scoped>
.hint {
  color: #6c757d;
  font-size: 13px;
  margin: 0 0 16px;
}

.meta-section {
  margin-top: 4px;
  padding-top: 16px;
  border-top: 2px solid #e9ecef;
}

.meta-section h3 {
  font-size: 14px;
  margin: 0 0 8px;
  color: #333;
}

.meta-hint {
  font-size: 12px;
  color: #6c757d;
  margin: 0 0 12px;
  line-height: 1.4;
}

.meta-hint code {
  font-size: 11px;
  background: #f1f3f5;
  padding: 1px 4px;
  border-radius: 3px;
}

.no-tags {
  padding: 10px 0;
  color: #6c757d;
  font-size: 12px;
}

.meta-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}

.meta-table th {
  padding: 6px;
  font-size: 11px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e9ecef;
}

.meta-table td {
  padding: 6px;
  font-size: 12px;
  border-bottom: 1px solid #e9ecef;
  word-break: break-word;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.meta-tag-row input {
  flex: 1;
  min-width: 120px;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}
</style>
