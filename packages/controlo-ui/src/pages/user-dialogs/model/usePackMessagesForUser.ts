/**
 * Сообщения пака в контексте пользователя
 * GET /api/users/:userId/packs/:packId/messages (cursor pagination)
 */
import { ref, watch, type Ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

export interface PackMessageForUser {
  messageId: string;
  dialogId: string;
  sourceDialogId?: string;
  content?: string;
  senderId?: string;
  createdAt: number;
  meta?: Record<string, unknown>;
  context?: { isMine?: boolean; status?: string };
  [key: string]: unknown;
}

interface LoadOptions {
  mode?: 'replace' | 'append';
  cursor?: string | null;
}

export function usePackMessagesForUser(
  userId: Ref<string | null>,
  packId: Ref<string | null>
) {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const packMessages = ref<PackMessageForUser[]>([]);
  const loadingPackMessages = ref(false);
  const packMessagesError = ref<string | null>(null);
  const packMessagesHasMore = ref(false);
  const packMessagesCursor = ref<{ next: string | null; prev: string | null }>({ next: null, prev: null });
  const packMessagesLimit = ref(20);

  async function loadPackMessagesForUser(options: LoadOptions = {}) {
    const uid = userId.value;
    const pid = packId.value;
    if (!uid || !pid) {
      packMessages.value = [];
      packMessagesHasMore.value = false;
      packMessagesCursor.value = { next: null, prev: null };
      return;
    }

    try {
      loadingPackMessages.value = true;
      packMessagesError.value = null;

      if (options.mode !== 'append') {
        packMessages.value = [];
      }

      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const params = new URLSearchParams({
        limit: packMessagesLimit.value.toString()
      });
      if (options.cursor) {
        params.set('cursor', options.cursor);
      }

      const url = `${baseUrl}/api/users/${encodeURIComponent(uid)}/packs/${encodeURIComponent(pid)}/messages?${params.toString()}`;
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders()
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const messages: PackMessageForUser[] = data.data || [];
      const cursorInfo = data.cursor || { next: null, prev: null };

      if (options.mode === 'append') {
        packMessages.value = [...packMessages.value, ...messages];
      } else {
        packMessages.value = messages;
      }

      packMessagesHasMore.value = Boolean(data.hasMore);
      packMessagesCursor.value = {
        next: cursorInfo.next ?? null,
        prev: cursorInfo.prev ?? null
      };
    } catch (err) {
      console.error('Error loading pack messages for user:', err);
      packMessagesError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      if (options.mode !== 'append') {
        packMessages.value = [];
        packMessagesHasMore.value = false;
        packMessagesCursor.value = { next: null, prev: null };
      }
    } finally {
      loadingPackMessages.value = false;
    }
  }

  function resetPackMessagesForUser() {
    packMessages.value = [];
    packMessagesHasMore.value = false;
    packMessagesCursor.value = { next: null, prev: null };
    packMessagesError.value = null;
  }

  async function loadInitialPackMessagesForUser() {
    await loadPackMessagesForUser({ mode: 'replace', cursor: null });
  }

  async function loadMorePackMessagesForUser() {
    if (!packMessagesCursor.value.next || loadingPackMessages.value) return;
    await loadPackMessagesForUser({ mode: 'append', cursor: packMessagesCursor.value.next });
  }

  function setPackMessagesLimitForUser(limit: number) {
    packMessagesLimit.value = Math.max(1, Math.min(100, limit));
  }

  watch(
    () => [userId.value, packId.value] as const,
    ([uid, pid]) => {
      if (uid && pid) {
        loadInitialPackMessagesForUser();
      } else {
        resetPackMessagesForUser();
      }
    }
  );

  return {
    packMessages,
    loadingPackMessages,
    packMessagesError,
    packMessagesHasMore,
    packMessagesCursor,
    packMessagesLimit,
    loadInitialPackMessagesForUser,
    loadMorePackMessagesForUser,
    resetPackMessagesForUser,
    setPackMessagesLimitForUser,
  };
}
