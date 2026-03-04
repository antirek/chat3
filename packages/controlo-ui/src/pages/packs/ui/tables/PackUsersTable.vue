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
        </tr>
      </template>
      <template #row="{ item }">
        <td><strong>{{ (item as PackUser).userId }}</strong></td>
      </template>
    </BaseTable>
  </div>
</template>

<script setup lang="ts">
import { BaseTable } from '@/shared/ui';

interface PackUser {
  userId: string;
}

interface Props {
  users: PackUser[];
  loading: boolean;
  error: string | null;
}

defineProps<Props>();
</script>

<style scoped>
.pack-users-table {
  flex: 1;
  overflow: auto;
}
</style>
