<template>
  <BaseModal :is-open="isOpen" title="Создать топик" max-width="600px" @close="$emit('close')">
    <form @submit.prevent="$emit('submit')">
      <div class="form-group">
        <label>Мета-теги (опционально):</label>
        <div class="meta-tags">
          <div v-for="(metaTag, index) in metaTags" :key="index" class="meta-tag-row">
            <input type="text" :value="metaTag.key" @input="$emit('update-meta-key', index, ($event.target as HTMLInputElement).value)" placeholder="Ключ" />
            <input type="text" :value="metaTag.value" @input="$emit('update-meta-value', index, ($event.target as HTMLInputElement).value)" placeholder="Значение" />
            <button type="button" class="btn-remove" @click="$emit('remove-meta-row', index)" v-show="metaTags.length > 1">✕</button>
          </div>
        </div>
        <button type="button" class="btn-add" @click="$emit('add-meta-row')">➕ Добавить мета-тег</button>
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn-secondary" @click="$emit('close')">Отмена</button>
      <button type="submit" class="btn-success" @click="$emit('submit')">Создать</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface MetaTag { key: string; value: string; }
interface Props { isOpen: boolean; metaTags: MetaTag[]; }

defineProps<Props>();
defineEmits<{
  (e: 'close'): void; (e: 'submit'): void;
  (e: 'add-meta-row'): void; (e: 'remove-meta-row', index: number): void;
  (e: 'update-meta-key', index: number, value: string): void; (e: 'update-meta-value', index: number, value: string): void;
}>();
</script>

<style scoped>
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; color: #495057; }
.meta-tags { margin-top: 10px; }
.meta-tag-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
.meta-tag-row input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.btn-remove { padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn-add { margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn-success { padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
.btn-secondary { padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
</style>
