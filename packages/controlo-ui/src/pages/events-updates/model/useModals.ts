/**
 * Модуль работы с модальными окнами
 * Отвечает за: показ модальных окон для JSON и URL, копирование в буфер обмена
 */
import { ref, Ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { getControlApiUrl, getTenantId } from './useUtils';
import { useCredentialsStore } from '@/app/stores/credentials';
import { copyJsonFromModal } from '@/shared/lib/utils/clipboard';

interface UseModalsDependencies {
  credentialsStore: ReturnType<typeof useCredentialsStore>;
  eventsPagination: {
    currentPage: Ref<number>;
    currentLimit: Ref<number>;
  };
  updatesPagination: {
    currentPage: Ref<number>;
    currentLimit: Ref<number>;
  };
  currentEventsFilter: Ref<string>;
  currentUpdatesFilter: Ref<string>;
  selectedEventId: Ref<string | null>;
}

export function useModals(deps: UseModalsDependencies) {
  const {
    credentialsStore,
    eventsPagination,
    updatesPagination,
    currentEventsFilter,
    currentUpdatesFilter,
    selectedEventId,
  } = deps;

  // Модальные окна
  const urlModal = useModal();
  const jsonModal = useModal();
  const urlModalContent = ref('');
  const jsonModalUrl = ref('');
  const jsonModalContent = ref('');

  // Показать JSON события
  function showEventJson(eventJson: any) {
    const params = new URLSearchParams({
      tenantId: getTenantId(credentialsStore),
      page: eventsPagination.currentPage.value.toString(),
      limit: eventsPagination.currentLimit.value.toString(),
    });
    if (currentEventsFilter.value) {
      const filterParts = currentEventsFilter.value.split('=');
      if (filterParts.length === 2) {
        params.append(filterParts[0].trim(), filterParts[1].trim());
      }
    }
    jsonModalUrl.value = getControlApiUrl(`/api/events?${params.toString()}`);
    jsonModalContent.value = JSON.stringify(eventJson, null, 2);
    jsonModal.open();
  }

  // Показать JSON обновления
  function showUpdateJson(_updateId: string, updateJson: any) {
    const params = new URLSearchParams({
      tenantId: getTenantId(credentialsStore),
      page: updatesPagination.currentPage.value.toString(),
      limit: updatesPagination.currentLimit.value.toString(),
    });
    if (selectedEventId.value) {
      params.append('eventId', selectedEventId.value);
    }
    jsonModalUrl.value = getControlApiUrl(`/api/updates?${params.toString()}`);
    jsonModalContent.value = JSON.stringify(updateJson, null, 2);
    jsonModal.open();
  }

  // Показать модальное окно URL
  function showUrlModal(type: 'events' | 'updates') {
    let url = '';

    if (type === 'events') {
      const params = new URLSearchParams({
        tenantId: getTenantId(credentialsStore),
        page: eventsPagination.currentPage.value.toString(),
        limit: eventsPagination.currentLimit.value.toString(),
      });
      if (currentEventsFilter.value) {
        const filterParts = currentEventsFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }
      url = getControlApiUrl(`/api/events?${params.toString()}`);
    } else {
      const params = new URLSearchParams({
        tenantId: getTenantId(credentialsStore),
        page: updatesPagination.currentPage.value.toString(),
        limit: updatesPagination.currentLimit.value.toString(),
      });
      if (selectedEventId.value) {
        params.append('eventId', selectedEventId.value);
      }
      if (currentUpdatesFilter.value) {
        const filterParts = currentUpdatesFilter.value.split('=');
        if (filterParts.length === 2) {
          params.append(filterParts[0].trim(), filterParts[1].trim());
        }
      }
      url = getControlApiUrl(`/api/updates?${params.toString()}`);
    }

    urlModalContent.value = url;
    urlModal.open();
  }

  // Копировать URL
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(urlModalContent.value);
      alert('URL скопирован в буфер обмена');
    } catch (error) {
      console.error('Error copying URL:', error);
    }
  }

  // Копировать JSON
  async function copyJson(button?: HTMLElement) {
    copyJsonFromModal(jsonModalContent.value, button || null);
  }

  // Инициализация обработчика Esc
  function initEscHandler() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        urlModal.close();
        jsonModal.close();
      }
    });
  }

  return {
    urlModal,
    jsonModal,
    urlModalContent,
    jsonModalUrl,
    jsonModalContent,
    showEventJson,
    showUpdateJson,
    showUrlModal,
    copyUrl,
    copyJson,
    initEscHandler,
  };
}
