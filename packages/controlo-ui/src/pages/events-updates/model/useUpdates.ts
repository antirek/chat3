/**
 * Модуль работы с обновлениями
 * Отвечает за: загрузку обновлений, пагинацию обновлений, сортировку
 */
import { ref, computed, Ref } from 'vue';
import { getControlApiUrl, getTenantId } from './useUtils';
import { useCredentialsStore } from '@/app/stores/credentials';

interface UseUpdatesDependencies {
  credentialsStore: ReturnType<typeof useCredentialsStore>;
  pagination: {
    currentPage: Ref<number>;
    currentLimit: Ref<number>;
    totalPages: Ref<number>;
    setPaginationData: (total: number, pages: number) => void;
  };
  currentFilter: Ref<string>;
  selectedEventId: Ref<string | null>;
}

export function useUpdates(deps: UseUpdatesDependencies) {
  const { credentialsStore, pagination, currentFilter, selectedEventId } = deps;

  // State для обновлений
  const updates = ref<any[]>([]);
  const loadingUpdates = ref(false);
  const updatesError = ref<string | null>(null);

  // Computed
  const updatesTotal = computed(() => pagination.totalPages.value * pagination.currentLimit.value);
  const updatesPaginationInfo = computed(() => {
    const total = updatesTotal.value;
    const start = (pagination.currentPage.value - 1) * pagination.currentLimit.value + 1;
    const end = Math.min(pagination.currentPage.value * pagination.currentLimit.value, total);
    return `${start}-${end} из ${total}`;
  });

  // Загрузить обновления
  async function loadUpdates() {
    loadingUpdates.value = true;
    updatesError.value = null;

    try {
      const params = new URLSearchParams({
        tenantId: getTenantId(credentialsStore),
        page: pagination.currentPage.value.toString(),
        limit: pagination.currentLimit.value.toString(),
      });

      // Если выбрано событие, фильтруем по eventId
      if (selectedEventId.value) {
        params.append('eventId', selectedEventId.value);
      }

      // Добавить фильтры
      if (currentFilter.value) {
        const filterParts = currentFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }

      const url = getControlApiUrl(`/api/updates?${params.toString()}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      const updatesData = result.data || [];
      const paginationData = result.pagination || {};

      pagination.setPaginationData(
        (paginationData.total || updatesData.length),
        paginationData.pages || 1
      );
      updates.value = updatesData;
    } catch (error) {
      updatesError.value = error instanceof Error ? error.message : 'Unknown error';
      updates.value = [];
    } finally {
      loadingUpdates.value = false;
    }
  }

  // Сортировка (заглушка)
  function sortUpdates(field: string) {
    console.log(`Нажато: ${field}`)
  }

  return {
    updates,
    loadingUpdates,
    updatesError,
    updatesTotal,
    updatesPaginationInfo,
    loadUpdates,
    sortUpdates,
  };
}
