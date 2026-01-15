<template>
  <BaseModal :is-open="isOpen" :title="title" max-width="1200px" @close="$emit('close')">
    <div v-html="body"></div>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  title: string;
  body: string;
}

defineProps<Props>();
defineEmits<{ (e: 'close'): void }>();
</script>
