/**
 * Загрузка диалогов выбранного пака
 * GET /api/packs/:packId/dialogs — page, limit, filter (meta диалогов, dialogId)
 */
import { ref, watch } from 'vue';

export function usePackDialogs(
  getApiKey: () => string,
  configStore: any,
  credentialsStore: any,
  onPackListChanged?: () => void,
) {
  const selectedPackId = ref<string | null>(null);
  const packDialogs = ref<Array<{ dialogId: string; addedAt: number }>>([]);
  const packDialogsLoading = ref(false);
  const packDialogsError = ref<string | null>(null);
  const packDialogsPage = ref(1);
  const packDialogsLimit = ref(10);
  const packDialogsTotal = ref(0);
  const packDialogsTotalPages = ref(0);
  const packDialogsFilterValue = ref('');

  async function loadPackDialogs(page = packDialogsPage.value, limit = packDialogsLimit.value) {
    const packId = selectedPackId.value;
    if (!packId) {
      packDialogs.value = [];
      packDialogsTotal.value = 0;
      packDialogsTotalPages.value = 0;
      return;
    }
    try {
      const key = getApiKey();
      if (!key) {
        packDialogs.value = [];
        return;
      }
      packDialogsLoading.value = true;
      packDialogsError.value = null;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      const filterTrim = packDialogsFilterValue.value.trim();
      if (filterTrim) params.set('filter', filterTrim);
      const url = `${baseUrl}/api/packs/${packId}/dialogs?${params.toString()}`;
      const response = await fetch(url, { headers: credentialsStore.getHeaders() });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      packDialogs.value = data.data || [];
      const total = data.pagination?.total ?? 0;
      const pages = data.pagination?.pages ?? 1;
      packDialogsTotal.value = total;
      packDialogsTotalPages.value = pages;
      packDialogsPage.value = data.pagination?.page ?? page;
    } catch (err) {
      console.error('Error loading pack dialogs:', err);
      packDialogsError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      packDialogs.value = [];
    } finally {
      packDialogsLoading.value = false;
    }
  }

  function selectPack(packId: string | null) {
    selectedPackId.value = packId;
    packDialogsPage.value = 1;
    if (packId) {
      loadPackDialogs(1, packDialogsLimit.value);
    } else {
      packDialogs.value = [];
      packDialogsTotal.value = 0;
      packDialogsTotalPages.value = 0;
    }
  }

  function goToPackDialogsPage(page: number) {
    packDialogsPage.value = page;
    loadPackDialogs(page, packDialogsLimit.value);
  }

  function changePackDialogsLimit(limit: number) {
    packDialogsLimit.value = limit;
    loadPackDialogs(1, limit);
  }

  function applyPackDialogsFilter() {
    loadPackDialogs(1, packDialogsLimit.value);
  }

  function clearPackDialogsFilter() {
    packDialogsFilterValue.value = '';
    loadPackDialogs(1, packDialogsLimit.value);
  }

  async function removeDialogFromPack(dialogId: string) {
    const packId = selectedPackId.value;
    if (!packId) return;

    const confirmed = confirm(
      `Удалить диалог «${dialogId}» из пака «${packId}»?\n\n` +
        'Будет удалена только связь пак ↔ диалог. Сам диалог и его сообщения останутся в системе.',
    );
    if (!confirmed) return;

    try {
      const key = getApiKey();
      if (!key) {
        alert('Укажите API Key');
        return;
      }
      packDialogsLoading.value = true;
      packDialogsError.value = null;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/packs/${encodeURIComponent(packId)}/dialogs/${encodeURIComponent(dialogId)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `HTTP ${response.status}`);
      }

      const remaining = packDialogs.value.length - 1;
      const page =
        remaining === 0 && packDialogsPage.value > 1
          ? packDialogsPage.value - 1
          : packDialogsPage.value;
      await loadPackDialogs(page, packDialogsLimit.value);
      onPackListChanged?.();
    } catch (err) {
      console.error('Error removing dialog from pack:', err);
      packDialogsError.value = err instanceof Error ? err.message : 'Ошибка удаления';
      alert('Ошибка: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    } finally {
      packDialogsLoading.value = false;
    }
  }

  const packDialogsPaginationStart = ref(0);
  const packDialogsPaginationEnd = ref(0);
  watch(
    () => [packDialogsPage.value, packDialogsLimit.value, packDialogsTotal.value],
    () => {
      const start = (packDialogsPage.value - 1) * packDialogsLimit.value + 1;
      const end = Math.min(packDialogsPage.value * packDialogsLimit.value, packDialogsTotal.value);
      packDialogsPaginationStart.value = packDialogsTotal.value > 0 ? start : 0;
      packDialogsPaginationEnd.value = end;
    },
    { immediate: true }
  );

  return {
    selectedPackId,
    packDialogs,
    packDialogsLoading,
    packDialogsError,
    packDialogsPage,
    packDialogsLimit,
    packDialogsTotal,
    packDialogsTotalPages,
    packDialogsPaginationStart,
    packDialogsPaginationEnd,
    packDialogsFilterValue,
    loadPackDialogs,
    selectPack,
    goToPackDialogsPage,
    changePackDialogsLimit,
    applyPackDialogsFilter,
    clearPackDialogsFilter,
    removeDialogFromPack,
  };
}
