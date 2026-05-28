<template>
  <BaseModal
    :is-open="isOpen"
    title="Отметить прочитанным"
    max-width="480px"
    @close="close"
  >
    <div class="modal-body">
      <p class="pack-id">
        Пак: <strong>{{ packId || '—' }}</strong>
      </p>
      <p class="hint">
        Все сообщения пака будут отмечены прочитанными для выбранных типов участников.
      </p>
      <div class="form-group">
        <label>Для кого отметить прочитанным</label>
        <select v-model="selectedMemberType" class="member-type-select">
          <option value="">Все участники (user, contact, bot)</option>
          <option value="user">Только пользователи (user)</option>
          <option value="contact">Только контакты (contact)</option>
          <option value="bot">Только боты (bot)</option>
        </select>
      </div>
      <p v-if="submitError" class="error">{{ submitError }}</p>
    </div>
    <template #footer>
      <BaseButton variant="secondary" :disabled="submitting" @click="close">
        Отмена
      </BaseButton>
      <BaseButton
        variant="success"
        :disabled="submitting || !packId"
        @click="handleSubmit"
      >
        {{ submitting ? 'Выполняется…' : 'Отметить прочитанным' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  packId: string;
  submitting: boolean;
  submitError: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', memberType: string): void;
}>();

const selectedMemberType = ref('');

watch(
  () => props.isOpen,
  (open) => {
    if (open) selectedMemberType.value = '';
  }
);

function close() {
  emit('close');
}

function handleSubmit() {
  emit('submit', selectedMemberType.value);
}
</script>

<style scoped>
.modal-body {
  padding: 0 4px;
}
.pack-id {
  margin-bottom: 12px;
  font-size: 14px;
  color: #495057;
}
.hint {
  margin-bottom: 16px;
  font-size: 13px;
  color: #6c757d;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}
.member-type-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  background: #fff;
}
.error {
  margin-top: 12px;
  font-size: 13px;
  color: #dc3545;
}
</style>
