<template>
  <BaseModal :is-open="isOpen" title="Создать пользователя" max-width="600px" @close="close">
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="createUserId">User ID *</label>
        <input type="text" id="createUserId" v-model="localUserId" required placeholder="john" />
      </div>
      <div class="form-group">
        <label for="createType">Тип</label>
        <select id="createType" v-model="localType">
          <option value="user">user</option>
          <option value="bot">bot</option>
          <option value="contact">contact</option>
          <option value="agent">agent</option>
        </select>
      </div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Отмена</BaseButton>
      <BaseButton variant="success" @click="handleSubmit">Создать</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  userId: string;
  type: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:userId', value: string): void;
  (e: 'update:type', value: string): void;
}>();

const localUserId = ref(props.userId);
const localType = ref(props.type);

watch(() => props.userId, (val) => { localUserId.value = val; });
watch(() => props.type, (val) => { localType.value = val; });
watch(localUserId, (val) => { emit('update:userId', val); });
watch(localType, (val) => { emit('update:type', val); });

function close() { emit('close'); }
function handleSubmit() { emit('submit'); }
</script>

<style scoped>
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: #495057; font-size: 13px; }
.form-group input, .form-group select { width: 100%; padding: 8px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; }
</style>
