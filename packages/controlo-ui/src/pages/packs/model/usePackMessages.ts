import { ref, watch, type Ref } from 'vue';

interface PackMessage {
  messageId: string;
  dialogId: string;
  content?: string;
  senderId?: string;
  senderInfo?: {
    userId: string;
    createdAt: number | null;
    meta: Record<string, unknown>;
  } | null;
  createdAt: number;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

interface LoadModeOptions {
  mode?: 'replace' | 'append';
  cursor?: string | null;
}

export function usePackMessages(
  getApiKey: () => string,
  configStore: any,
  credentialsStore: any,
  selectedPackId: Ref<string | null>
) {
  const packMessages = ref<PackMessage[]>([]);
  const packMessagesLoading = ref(false);
  const packMessagesError = ref<string | null>(null);
  const packMessagesHasMore = ref(false);
  const packMessagesCursor = ref<{ next: string | null; prev: string | null }>({ next: null, prev: null });
  const packMessagesLimit = ref(20);

  async function loadPackMessages(options: LoadModeOptions = {}) {
    const packId = selectedPackId.value;
    if (!packId) {
      packMessages.value = [];
      packMessagesHasMore.value = false;
      packMessagesCursor.value = { next: null, prev: null };
      return;
    }

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        packMessages.value = [];
        packMessagesHasMore.value = false;
        packMessagesCursor.value = { next: null, prev: null };
        return;
      }

      packMessagesLoading.value = true;
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

      const response = await fetch(`${baseUrl}/api/packs/${packId}/messages?${params.toString()}`, {
        headers: credentialsStore.getHeaders()
      });

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(errorPayload.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const messages: PackMessage[] = data.data || [];
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
    } catch (error) {
      console.error('Error loading pack messages:', error);
      packMessagesError.value = error instanceof Error ? error.message : 'Ошибка загрузки сообщений';
      if (options.mode !== 'append') {
        packMessages.value = [];
        packMessagesHasMore.value = false;
        packMessagesCursor.value = { next: null, prev: null };
      }
    } finally {
      packMessagesLoading.value = false;
    }
  }

  function resetPackMessages() {
    packMessages.value = [];
    packMessagesHasMore.value = false;
    packMessagesCursor.value = { next: null, prev: null };
  }

  async function loadInitialPackMessages() {
    await loadPackMessages({ mode: 'replace', cursor: null });
  }

  async function loadMorePackMessages() {
    if (!packMessagesCursor.value.next || packMessagesLoading.value) {
      return;
    }
    await loadPackMessages({ mode: 'append', cursor: packMessagesCursor.value.next });
  }

  function changePackMessagesLimit(limit: number) {
    packMessagesLimit.value = limit;
    loadInitialPackMessages();
  }

  watch(
    () => selectedPackId.value,
    (packId) => {
      if (packId) {
        loadInitialPackMessages();
      } else {
        resetPackMessages();
      }
    }
  );

  return {
    packMessages,
    packMessagesLoading,
    packMessagesError,
    packMessagesHasMore,
    packMessagesCursor,
    packMessagesLimit,
    loadInitialPackMessages,
    loadMorePackMessages,
    changePackMessagesLimit,
    resetPackMessages,
  };
}
