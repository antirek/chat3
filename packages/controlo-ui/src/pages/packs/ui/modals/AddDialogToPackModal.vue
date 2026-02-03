<template>
  <BaseModal :is-open="isOpen" title="Добавить диалог в пак" max-width="500px" @close="close">
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="addDialogDialogId">Dialog ID</label>
        <input
          id="addDialogDialogId"
          v-model="localDialogId"
          type="text"
          placeholder="dlg_..."
          @input="emit('update:dialogId', localDialogId)"
        />
        <small>Формат: dlg_ и 20 символов (a-z, 0-9). Диалог должен быть в том же тенанте.</small>
      </div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Отмена</BaseButton>
      <BaseButton variant="success" @click="handleSubmit">Добавить</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  packId: string;
  dialogId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:dialogId', value: string): void;
}>();

const localDialogId = ref(props.dialogId);

watch(() => props.dialogId, (val) => { localDialogId.value = val; });

function close() { emit('close'); }
function handleSubmit() { emit('submit'); }
</script>

<style scoped>
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: #495057; font-size: 13px; }
.form-group input { width: 100%; padding: 8px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; }
.form-group small { display: block; margin-top: 4px; color: #6c757d; font-size: 11px; }
</style>
