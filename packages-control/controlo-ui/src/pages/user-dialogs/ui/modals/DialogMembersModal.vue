<template>
  <BaseModal
    :is-open="isOpen"
    :title="modalTitle"
    max-width="700px"
    @close="close"
  >
    <div class="dialog-members-content">
      <div v-if="loading" class="loading">Загрузка участников...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="!dialogId" class="placeholder">Диалог не выбран</div>
      <template v-else>
        <BaseTable
          v-if="members.length > 0"
          class="members-table"
          :items="members"
          :get-item-key="(item) => item.userId"
          loading-text=""
          empty-text=""
        >
          <template #header>
            <tr>
              <th>Пользователь</th>
              <th style="text-align: center;">Непрочитанные</th>
              <th style="text-align: center;">Активен</th>
            </tr>
          </template>
          <template #row="{ item }">
            <td class="user-cell">{{ item.userId }}</td>
            <td style="text-align: center;">{{ item.unreadCount ?? 0 }}</td>
            <td style="text-align: center;">
              <span :style="{ color: item.isActive ? '#28a745' : '#dc3545' }">{{ item.isActive ? '✓' : '✗' }}</span>
            </td>
          </template>
        </BaseTable>
        <div v-else class="empty">Участников нет</div>
      </template>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { BaseModal, BaseTable, BaseButton } from '@/shared/ui';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

interface Member {
  userId: string;
  unreadCount?: number;
  isActive?: boolean;
}

interface Props {
  isOpen: boolean;
  dialogId: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'close'): void }>();

const configStore = useConfigStore();
const credentialsStore = useCredentialsStore();

const members = ref<Member[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const modalTitle = computed(() => {
  if (!props.dialogId) return 'Участники диалога';
  const id = props.dialogId;
  const short = id.length <= 20 ? id : id.substring(0, 8) + '…' + id.substring(id.length - 8);
  return `Участники диалога (${short})`;
});

async function loadMembers(dialogId: string) {
  loading.value = true;
  error.value = null;
  try {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/dialogs/${encodeURIComponent(dialogId)}/members?page=1&limit=100&sort=(joinedAt,asc)`;
    const response = await fetch(url, { headers: credentialsStore.getHeaders() });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    members.value = data.data ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
    members.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.isOpen, props.dialogId] as const,
  ([open, id]) => {
    if (open && id) {
      loadMembers(id);
    } else {
      members.value = [];
      error.value = null;
    }
  }
);

function close() {
  emit('close');
}
</script>

<style scoped>
.dialog-members-content {
  min-height: 120px;
  padding: 0;
}

.loading,
.error,
.placeholder,
.empty {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

.user-cell {
  font-weight: 500;
}

.members-table {
  width: 100%;
}
</style>
