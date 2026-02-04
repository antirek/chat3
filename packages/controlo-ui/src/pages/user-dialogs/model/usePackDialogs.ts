/**
 * Модуль загрузки диалогов пака
 * GET /api/packs/:packId/dialogs
 */
import { ref, computed } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

export interface PackDialogItem {
  dialogId: string;
  addedAt: number;
}

export function usePackDialogs() {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const packDialogs = ref<PackDialogItem[]>([]);
  const loadingPackDialogs = ref(false);
  const packDialogsError = ref<string | null>(null);
  const packDialogsTotal = ref(0);
  const packDialogsPage = ref(1);
  const packDialogsLimit = ref(20);
  const packDialogsTotalPages = ref(0);

  const packDialogsPaginationStart = computed(() => {
    const total = packDialogsTotal.value;
    if (total === 0) return 0;
    return (packDialogsPage.value - 1) * packDialogsLimit.value + 1;
  });
  const packDialogsPaginationEnd = computed(() => {
    const end = packDialogsPage.value * packDialogsLimit.value;
    return Math.min(end, packDialogsTotal.value);
  });

  async function loadPackDialogs(packId: string | null, page = 1, limit?: number) {
    if (!packId) {
      packDialogs.value = [];
      packDialogsTotal.value = 0;
      packDialogsPage.value = 1;
      packDialogsTotalPages.value = 0;
      return;
    }
    try {
      loadingPackDialogs.value = true;
      packDialogsError.value = null;
      const currentLimit = limit ?? packDialogsLimit.value;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/packs/${encodeURIComponent(packId)}/dialogs?page=${page}&limit=${currentLimit}`;
      const response = await fetch(url, { headers: credentialsStore.getHeaders() });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      packDialogs.value = data.data ?? [];
      const pagination = data.pagination ?? {};
      packDialogsTotal.value = pagination.total ?? 0;
      packDialogsPage.value = pagination.page ?? page;
      packDialogsLimit.value = pagination.limit ?? currentLimit;
      packDialogsTotalPages.value = pagination.pages ?? (Math.ceil((pagination.total ?? 0) / (pagination.limit ?? currentLimit)) || 1);
    } catch (err) {
      console.error('Error loading pack dialogs:', err);
      packDialogsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      packDialogs.value = [];
    } finally {
      loadingPackDialogs.value = false;
    }
  }

  function clearPackDialogs() {
    packDialogs.value = [];
    packDialogsTotal.value = 0;
    packDialogsPage.value = 1;
    packDialogsTotalPages.value = 0;
    packDialogsError.value = null;
  }

  function setPackDialogsLimit(limit: number) {
    packDialogsLimit.value = Math.max(1, Math.min(50, limit));
  }

  return {
    packDialogs,
    loadingPackDialogs,
    packDialogsError,
    packDialogsTotal,
    packDialogsPage,
    packDialogsLimit,
    packDialogsTotalPages,
    packDialogsPaginationStart,
    packDialogsPaginationEnd,
    loadPackDialogs,
    clearPackDialogs,
    setPackDialogsLimit,
  };
}
