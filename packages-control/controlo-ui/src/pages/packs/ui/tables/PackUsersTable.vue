<template>
  <div class="pack-users-table">
    <BaseTable
      :items="users"
      :loading="loading"
      :error="error"
      loading-text="Загрузка участников..."
      empty-text="В диалогах пака нет участников."
      :get-item-key="(u) => (u as PackUser).userId"
    >
      <template #header>
        <tr>
          <th>User ID</th>
          <th>Действия</th>
        </tr>
      </template>
      <template #row="{ item }">
        <td><strong>{{ (item as PackUser).userId }}</strong></td>
        <td>
          <BaseButton
            size="small"
            variant="danger"
            :disabled="removingUserId === (item as PackUser).userId"
            @click="removeUser((item as PackUser).userId)"
          >
            {{ removingUserId === (item as PackUser).userId ? 'Удаление…' : 'Удалить' }}
          </BaseButton>
        </td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable, BaseButton } from '@/shared/ui';

interface PackUser {
  userId: string;
}

interface Props {
  users: PackUser[];
  loading: boolean;
  error: string | null;
  removingUserId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  removingUserId: null
});

const emit = defineEmits<{
  (e: 'remove-user', userId: string): void;
}>();

function removeUser(userId: string) {
  emit('remove-user', userId);
}
</script>

<style scoped>
.pack-users-table {
  flex: 1;
  overflow: auto;
}
</style>
