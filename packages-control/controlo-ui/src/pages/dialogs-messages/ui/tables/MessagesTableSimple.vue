<template>
  <div class="messages-content">
    <div v-if="!currentDialogId" class="placeholder">Выберите диалог</div>
    <BaseTable
      v-else
      class="messages-table"
      :items="messages"
      :loading="loading"
      :error="error"
      loading-text="Загрузка сообщений..."
      empty-text="Сообщения не найдены"
      :get-item-key="(message) => message.messageId"
    >
      <template #header>
        <tr>
          <th>Отправитель</th>
          <th @click="toggleSort('createdAt')" style="cursor: pointer;">
            Время
            <span class="sort-indicator" :class="{ active: currentSort && currentSort.includes('createdAt') }">
              {{ getSortIndicator('createdAt') }}
            </span>
          </th>
          <th>Содержимое</th>
          <th>Тип</th>
          <th>Инфо</th>
        </tr>
      </template>

      <template #row="{ item }">
        <td>
          <span
            class="sender-link"
            @mouseenter="handleSenderEnter($event, (item as Message).senderId)"
            @mousemove="handleSenderMove"
            @mouseleave="handleSenderLeave"
          >
            {{ (item as Message).senderId }}
          </span>
        </td>
        <td :title="(item as Message).createdAt != null ? String((item as Message).createdAt) : undefined">{{ formatTimestamp((item as Message).createdAt) }}</td>
        <td class="message-content">{{ (item as Message).content }}</td>
        <td>{{ (item as Message).type }}</td>
        <td>
          <BaseButton variant="primary" size="small" @click="showInfo(item as Message)">
            ℹ️ Инфо
          </BaseButton>
        </td>
      </template>
    </BaseTable>
    <div
      v-if="hoverVisible"
      class="user-hover-popover"
      :style="{ left: `${hoverX}px`, top: `${hoverY}px` }"
    >
      <div class="user-hover-title">Пользователь</div>
      <div v-if="hoverLoading" class="user-hover-loading">Загрузка...</div>
      <div v-else-if="hoverError" class="user-hover-error">{{ hoverError }}</div>
      <template v-else-if="hoverUser">
        <div class="user-hover-row"><strong>ID:</strong> {{ hoverUser.userId }}</div>
        <div class="user-hover-row"><strong>Имя:</strong> {{ hoverUser.name || '—' }}</div>
        <div class="user-hover-row"><strong>Тип:</strong> {{ hoverUser.type || '—' }}</div>
        <div class="user-hover-row">
          <strong>Активен:</strong>
          {{ hoverUser.isActive === undefined ? '—' : (hoverUser.isActive ? 'да' : 'нет') }}
        </div>
        <div v-if="hoverUser.meta && Object.keys(hoverUser.meta).length" class="user-hover-meta">
          <strong>Meta:</strong>
          <pre>{{ JSON.stringify(hoverUser.meta, null, 2) }}</pre>
        </div>
      </template>
      <div v-else class="user-hover-loading">Нет данных</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { BaseTable, BaseButton } from '@/shared/ui';

interface Message {
  messageId: string;
  senderId: string;
  createdAt?: string | number;
  content?: string;
  type?: string;
}

interface Props {
  messages: Message[];
  loading: boolean;
  error: string | null;
  currentDialogId: string | null;
  currentSort: string | null;
  getSortIndicator: (field: string) => string;
  toggleSort: (field: string) => void;
  formatTimestamp: (timestamp?: string | number) => string;
  showInfo: (message: Message) => void;
}

interface UserPreview {
  userId: string;
  name?: string;
  type?: string;
  isActive?: boolean;
  meta?: Record<string, unknown>;
}

const props = defineProps<Props>();

const configStore = useConfigStore();
const credentialsStore = useCredentialsStore();

const hoverVisible = ref(false);
const hoverLoading = ref(false);
const hoverError = ref<string | null>(null);
const hoverUser = ref<UserPreview | null>(null);
const hoverX = ref(0);
const hoverY = ref(0);
const hoveredSenderId = ref('');

const userPreviewCache = new Map<string, UserPreview>();

function setHoverPosition(event: MouseEvent) {
  hoverX.value = event.clientX + 12;
  hoverY.value = event.clientY + 16;
}

async function loadUserPreview(userId: string) {
  if (userPreviewCache.has(userId)) {
    hoverUser.value = userPreviewCache.get(userId) || null;
    hoverLoading.value = false;
    hoverError.value = null;
    return;
  }

  hoverLoading.value = true;
  hoverError.value = null;
  hoverUser.value = null;

  try {
    const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/users/${encodeURIComponent(userId)}`, {
      headers: credentialsStore.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const payload = data?.data || data || {};
    const preview: UserPreview = {
      userId: payload.userId || userId,
      name: payload.name || payload.meta?.name || undefined,
      type: payload.type || undefined,
      isActive: typeof payload.isActive === 'boolean' ? payload.isActive : undefined,
      meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : undefined,
    };
    userPreviewCache.set(userId, preview);
    if (hoveredSenderId.value === userId) {
      hoverUser.value = preview;
    }
  } catch (error) {
    if (hoveredSenderId.value === userId) {
      hoverError.value = error instanceof Error ? error.message : 'Ошибка загрузки пользователя';
    }
  } finally {
    if (hoveredSenderId.value === userId) {
      hoverLoading.value = false;
    }
  }
}

async function handleSenderEnter(event: MouseEvent, senderId: string) {
  if (!props.currentDialogId) {
    return;
  }
  hoveredSenderId.value = senderId;
  hoverVisible.value = true;
  setHoverPosition(event);
  await loadUserPreview(senderId);
}

function handleSenderMove(event: MouseEvent) {
  if (!hoverVisible.value) {
    return;
  }
  setHoverPosition(event);
}

function handleSenderLeave() {
  hoverVisible.value = false;
  hoverLoading.value = false;
  hoverError.value = null;
  hoverUser.value = null;
  hoveredSenderId.value = '';
}
</script>

<style scoped>
.messages-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}



.message-content {
  max-width: 100%;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.sender-link {
  cursor: help;
  color: #2f6feb;
  text-decoration: underline dotted;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
}

.placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.user-hover-popover {
  position: fixed;
  z-index: 2100;
  min-width: 230px;
  max-width: 320px;
  background: #fff;
  border: 1px solid #d9dee6;
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22);
  padding: 10px 12px;
  font-size: 12px;
  color: #1f2937;
  pointer-events: none;
}

.user-hover-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
}

.user-hover-row {
  margin: 4px 0;
  line-height: 1.3;
  word-break: break-word;
}

.user-hover-meta {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eceff4;
}

.user-hover-meta pre {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.3;
  white-space: pre-wrap;
  word-break: break-word;
}

.user-hover-loading {
  color: #6c757d;
}

.user-hover-error {
  color: #dc3545;
}

</style>
