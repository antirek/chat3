<template>
  <BaseModal :is-open="isOpen" title="Создать пак" max-width="400px" @close="close">
    <p class="hint">Будет создан новый пак без диалогов. Диалоги можно добавить после создания.</p>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Отмена</BaseButton>
      <BaseButton variant="success" @click="handleSubmit">Создать</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
}>();

function close() { emit('close'); }
function handleSubmit() { emit('submit'); }
</script>

<style scoped>
.hint {
  color: #6c757d;
  font-size: 13px;
  margin: 0;
}
</style>
