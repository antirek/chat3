/**
 * Участники пака — уникальные пользователи из всех диалогов пака
 * GET /api/packs/:packId/users. Фильтр и пагинация — на клиенте.
 */
import { ref, watch, computed, type Ref } from 'vue';

export function usePackUsers(
  getApiKey: () => string,
  configStore: { config: { TENANT_API_URL?: string } },
  credentialsStore: { getHeaders: () => Record<string, string> },
  selectedPackId: Ref<string | null>,
) {
  const packUsers = ref<Array<{ userId: string }>>([]);
  const packUsersLoading = ref(false);
  const packUsersError = ref<string | null>(null);
  const packUsersFilterValue = ref('');
  const packUsersPage = ref(1);
  const packUsersLimit = ref(20);

  const packUsersFiltered = computed(() => {
    const q = packUsersFilterValue.value.trim().toLowerCase();
    if (!q) return packUsers.value;
    return packUsers.value.filter((u) => u.userId.toLowerCase().includes(q));
  });

  const packUsersTotal = computed(() => packUsersFiltered.value.length);
  const packUsersTotalPages = computed(() =>
    Math.max(1, Math.ceil(packUsersTotal.value / packUsersLimit.value)
  ));
  const packUsersPaginationStart = computed(() =>
    packUsersTotal.value > 0 ? (packUsersPage.value - 1) * packUsersLimit.value + 1 : 0
  );
  const packUsersPaginationEnd = computed(() =>
    Math.min(packUsersPage.value * packUsersLimit.value, packUsersTotal.value)
  );
  const packUsersPaginated = computed(() => {
    const start = (packUsersPage.value - 1) * packUsersLimit.value;
    return packUsersFiltered.value.slice(start, start + packUsersLimit.value);
  });

  async function loadPackUsers() {
    const packId = selectedPackId.value;
    if (!packId) {
      packUsers.value = [];
      return;
    }
    try {
      const key = getApiKey();
      if (!key) {
        packUsers.value = [];
        return;
      }
      packUsersLoading.value = true;
      packUsersError.value = null;
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/packs/${encodeURIComponent(packId)}/users`;
      const response = await fetch(url, { headers: credentialsStore.getHeaders() });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { message?: string }).message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      packUsers.value = Array.isArray(data.data) ? data.data : [];
      packUsersPage.value = 1;
    } catch (err) {
      console.error('Error loading pack users:', err);
      packUsersError.value = err instanceof Error ? err.message : 'Ошибка загрузки';
      packUsers.value = [];
    } finally {
      packUsersLoading.value = false;
    }
  }

  function clearPackUsers() {
    packUsers.value = [];
    packUsersError.value = null;
  }

  function goToPackUsersPage(page: number) {
    packUsersPage.value = Math.max(1, Math.min(page, packUsersTotalPages.value));
  }

  function changePackUsersLimit(limit: number) {
    packUsersLimit.value = limit;
    packUsersPage.value = 1;
  }

  watch(selectedPackId, (id, prevId) => {
    if (id !== prevId) clearPackUsers();
  });

  return {
    packUsers,
    packUsersLoading,
    packUsersError,
    packUsersFilterValue,
    packUsersPage,
    packUsersLimit,
    packUsersFiltered,
    packUsersTotal,
    packUsersTotalPages,
    packUsersPaginationStart,
    packUsersPaginationEnd,
    packUsersPaginated,
    loadPackUsers,
    clearPackUsers,
    goToPackUsersPage,
    changePackUsersLimit,
  };
}
