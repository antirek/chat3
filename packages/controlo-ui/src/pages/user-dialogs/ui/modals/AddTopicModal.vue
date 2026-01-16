<template>
  <BaseModal :is-open="isOpen" title="Создать топик" max-width="600px" @close="$emit('close')">
    <form @submit.prevent="$emit('submit')">
      <div class="form-group">
        <label>Мета-теги (опционально):</label>
        <div class="meta-tags">
          <div v-for="(metaTag, index) in metaTags" :key="index" class="meta-tag-row">
            <input type="text" :value="metaTag.key" @input="$emit('update-meta-key', index, ($event.target as HTMLInputElement).value)" placeholder="Ключ" />
            <input type="text" :value="metaTag.value" @input="$emit('update-meta-value', index, ($event.target as HTMLInputElement).value)" placeholder="Значение" />
            <BaseButton type="button" variant="danger" size="small" @click="$emit('remove-meta-row', index)" v-show="metaTags.length > 1">✕</BaseButton>
          </div>
        </div>
        <BaseButton type="button" variant="success" @click="$emit('add-meta-row')">➕ Добавить мета-тег</BaseButton>
      </div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="$emit('close')">Отмена</BaseButton>
      <BaseButton variant="success" @click="$emit('submit')">Создать</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

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
</style>
