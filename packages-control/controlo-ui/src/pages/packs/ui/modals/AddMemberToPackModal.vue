<template>
  <BaseModal :is-open="isOpen" title="Добавить участника в пак" max-width="500px" @close="close">
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="addMemberUserId">User ID</label>
        <input
          id="addMemberUserId"
          v-model="localUserId"
          type="text"
          placeholder="user_..."
          @input="emit('update:userId', localUserId)"
        />
        <small>Пользователь будет добавлен во все диалоги выбранного пака.</small>
      </div>

      <div class="form-group">
        <label for="addMemberType">Тип пользователя (опционально)</label>
        <select
          id="addMemberType"
          v-model="localType"
          @change="emit('update:userType', localType)"
        >
          <option value="">Не указывать</option>
          <option value="user">user</option>
          <option value="contact">contact</option>
          <option value="bot">bot</option>
        </select>
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
  userId: string;
  userType: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:userId', value: string): void;
  (e: 'update:userType', value: string): void;
}>();

const localUserId = ref(props.userId);
const localType = ref(props.userType);

watch(() => props.userId, (val) => { localUserId.value = val; });
watch(() => props.userType, (val) => { localType.value = val; });

function close() { emit('close'); }
function handleSubmit() { emit('submit'); }
</script>

<style scoped>
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: #495057; font-size: 13px; }
.form-group input,
.form-group select { width: 100%; padding: 8px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; }
.form-group small { display: block; margin-top: 4px; color: #6c757d; font-size: 11px; }
</style>
