<template>
  <BaseModal :is-open="isOpen" :title="`Мета-теги участника: ${userId}`" max-width="800px" @close="$emit('close')">
    <div class="info-block">
      <div>Диалог: {{ dialogId }}</div>
      <div>Участник: {{ userId }}</div>
    </div>
    
    <div class="meta-editor">
      <div v-if="metaTags.length === 0" class="no-data">Мета-теги отсутствуют</div>
      <div v-else>
        <div v-for="(metaTag, index) in metaTags" :key="index" class="meta-row">
          <input type="text" :value="metaTag.key" @input="$emit('update-meta-key', index, ($event.target as HTMLInputElement).value)" placeholder="Ключ" :readonly="metaTag.isExisting" :class="{ readonly: metaTag.isExisting }" />
          <input type="text" :value="metaTag.value" @input="$emit('update-meta-value', index, ($event.target as HTMLInputElement).value)" placeholder="Значение" />
          <button type="button" class="btn-remove" @click="$emit('remove-meta-row', index)">✕</button>
        </div>
      </div>
    </div>
    
    <button type="button" class="btn-add" @click="$emit('add-meta-row')">➕ Добавить тег</button>
    
    <div v-if="status" class="status-message">{{ status }}</div>
    
    <template #footer>
      <button type="button" class="btn-secondary" @click="$emit('close')">Отмена</button>
      <button type="button" class="btn-primary" @click="$emit('save')">Сохранить</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface MetaTag { key: string; value: string; isExisting?: boolean; }
interface Props { isOpen: boolean; dialogId: string; userId: string; metaTags: MetaTag[]; status?: string; }

defineProps<Props>();
defineEmits<{
  (e: 'close'): void; (e: 'save'): void; (e: 'add-meta-row'): void;
  (e: 'remove-meta-row', index: number): void;
  (e: 'update-meta-key', index: number, value: string): void;
  (e: 'update-meta-value', index: number, value: string): void;
}>();
</script>

<style scoped>
.info-block { padding: 10px; background: #f8f9fa; border-radius: 4px; margin-bottom: 15px; font-size: 13px; }
.meta-editor { margin-top: 10px; }
.no-data { padding: 20px; text-align: center; color: #6c757d; background: #f8f9fa; border-radius: 4px; }
.meta-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
.meta-row input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.meta-row input.readonly { background: #e9ecef; }
.btn-remove { padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn-add { margin-top: 15px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
.status-message { margin-top: 15px; padding: 10px; border-radius: 4px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
.btn-primary { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
.btn-secondary { padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
</style>
