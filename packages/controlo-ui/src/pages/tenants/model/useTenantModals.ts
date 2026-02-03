/**
 * Модуль модальных окон для работы с тенантами
 * Отвечает за: создание, удаление тенантов, работа с meta-тегами, отображение информации, URL запросов
 */
import { ref, computed } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { useModal } from '@/shared/lib/composables/useModal';
import { copyJsonFromModal } from '@/shared/lib/utils/clipboard';
import type { Ref } from 'vue';

export function useTenantModals(
  getApiKey: () => string,
  configStore: ReturnType<typeof useConfigStore>,
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  currentPage: Ref<number>,
  currentLimit: Ref<number>,
  currentFilter: Ref<string | null>,
  currentSort: { value: { field: string; order: number } },
  loadTenants: (page?: number, limit?: number) => Promise<void>,
) {
  // Модальные окна
  const createModal = useModal();
  const metaModal = useModal();
  const infoModal = useModal();
  const urlModal = useModal();

  // Создание тенанта
  const createTenantId = ref('');
  const createMetaTags = ref<Array<{ key: string; value: any }>>([]);
  const newMetaKey = ref('');
  const newMetaValue = ref('');

  // Meta теги
  const metaTenantId = ref('');
  const metaTags = ref<Record<string, any> | null>(null);
  const newMetaKeyForEdit = ref('');
  const newMetaValueForEdit = ref('');

  // Info modal
  const infoUrl = ref('');
  const jsonViewerContent = ref('');
  const currentJsonForCopy = ref('');
  const copyJsonButtonText = ref('📋 Копировать JSON');

  // URL modal
  const generatedUrl = ref('');
  const copyUrlButtonText = ref('📋 Скопировать');

  // Create modal functions
  function showCreateModal() {
    createModal.open();
    createTenantId.value = '';
    createMetaTags.value = [];
    newMetaKey.value = '';
    newMetaValue.value = '';
  }

  function addCreateMetaTag() {
    const key = newMetaKey.value.trim();
    const valueStr = newMetaValue.value.trim();

    if (!key || !valueStr) {
      alert('Заполните ключ и значение');
      return;
    }

    let value: any;
    try {
      value = JSON.parse(valueStr);
    } catch {
      value = valueStr;
    }

    if (createMetaTags.value.find((tag) => tag.key === key)) {
      alert('Мета-тег с таким ключом уже добавлен');
      return;
    }

    createMetaTags.value.push({ key, value });
    newMetaKey.value = '';
    newMetaValue.value = '';
  }

  function removeCreateMetaTag(key: string) {
    createMetaTags.value = createMetaTags.value.filter((tag) => tag.key !== key);
  }

  async function createTenant() {
    const tenantData: any = {};

    const tenantIdValue = createTenantId.value.trim();
    if (tenantIdValue) {
      tenantData.tenantId = tenantIdValue.toLowerCase().trim();
    }

    if (createMetaTags.value.length > 0) {
      tenantData.meta = {};
      for (const tag of createMetaTags.value) {
        tenantData.meta[tag.key] = tag.value;
      }
    }

    try {
      const key = getApiKey();
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      };
      // При создании тенанта не отправляем X-Tenant-ID

      const response = await fetch(`${baseUrl}/api/tenants`, {
        method: 'POST',
        headers,
        body: JSON.stringify(tenantData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.message || 'Failed to create tenant';

        if (response.status === 400 && errorData.message?.includes('X-Tenant-Id')) {
          errorMessage =
            'Ошибка: заголовок X-Tenant-Id не должен отправляться при создании тенанта.';
        } else if (response.status === 409) {
          if (tenantIdValue) {
            errorMessage = `Тенант с ID "${tenantIdValue}" уже существует.`;
          } else {
            errorMessage = 'Ошибка: не удалось создать тенант с автоматически сгенерированным ID.';
          }
        }

        throw new Error(errorMessage);
      }

      createModal.close();
      loadTenants(1, currentLimit.value);
      alert('Тенант успешно создан!');
    } catch (err) {
      console.error('Error creating tenant:', err);
      alert('Ошибка создания тенанта: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  // Meta modal functions
  async function showMetaModal(tenantIdValue: string) {
    metaTenantId.value = tenantIdValue;
    metaModal.open();
    await loadMetaTags(tenantIdValue);
  }

  function closeMetaModal() {
    metaModal.close();
    metaTags.value = null;
    newMetaKeyForEdit.value = '';
    newMetaValueForEdit.value = '';
  }

  async function loadMetaTags(tenantIdValue: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      // Мета тенанта в API хранится с tenantId = id этого тенанта (см. tenantController.getById)
      const response = await fetch(`${baseUrl}/api/meta/tenant/${tenantIdValue}`, {
        headers: { ...credentialsStore.getHeaders(), 'X-Tenant-ID': tenantIdValue },
      });

      if (!response.ok) {
        throw new Error('Failed to load tenant meta');
      }

      const { data: meta } = await response.json();
      metaTags.value = meta || {};
    } catch (err) {
      console.error('Error loading meta tags:', err);
      metaTags.value = null;
    }
  }

  async function addMetaTag() {
    const tenantIdValue = metaTenantId.value;
    const key = newMetaKeyForEdit.value.trim();
    const valueStr = newMetaValueForEdit.value.trim();

    if (!key || !valueStr) {
      alert('Заполните ключ и значение');
      return;
    }

    let value: any;
    try {
      value = JSON.parse(valueStr);
    } catch {
      value = valueStr;
    }

    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/meta/tenant/${tenantIdValue}/${key}`, {
        method: 'PUT',
        headers: {
          ...credentialsStore.getHeaders(),
          'X-Tenant-ID': tenantIdValue,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set meta tag');
      }

      newMetaKeyForEdit.value = '';
      newMetaValueForEdit.value = '';
      await loadMetaTags(tenantIdValue);
      alert('Meta тег успешно добавлен!');
    } catch (err) {
      console.error('Error adding meta tag:', err);
      alert('Ошибка добавления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function deleteMetaTag(key: string) {
    if (!confirm(`Удалить meta тег "${key}"?`)) {
      return;
    }

    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/meta/tenant/${metaTenantId.value}/${key}`, {
        method: 'DELETE',
        headers: { ...credentialsStore.getHeaders(), 'X-Tenant-ID': metaTenantId.value },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete meta tag');
      }

      await loadMetaTags(metaTenantId.value);
      alert('Meta тег успешно удален!');
    } catch (err) {
      console.error('Error deleting meta tag:', err);
      alert('Ошибка удаления meta тега: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  // Info modal functions
  async function showInfoModal(tenantIdParam: string) {
    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/tenants/${tenantIdParam}`;

      infoUrl.value = url;

      const tenantResponse = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      const responseData = await tenantResponse.json();

      if (!tenantResponse.ok) {
        const errorJson = JSON.stringify(
          {
            status: tenantResponse.status,
            statusText: tenantResponse.statusText,
            error: responseData,
          },
          null,
          2,
        );
        jsonViewerContent.value = errorJson;
        currentJsonForCopy.value = errorJson;
      } else {
        const jsonStr = JSON.stringify(responseData, null, 2);
        jsonViewerContent.value = jsonStr;
        currentJsonForCopy.value = jsonStr;
      }

      infoModal.open();
      copyJsonButtonText.value = '📋 Копировать JSON';
    } catch (err) {
      console.error('Error loading tenant info:', err);
      const errorJson = JSON.stringify(
        {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        null,
        2,
      );
      jsonViewerContent.value = errorJson;
      currentJsonForCopy.value = errorJson;
      infoModal.open();
    }
  }

  async function copyJsonToClipboard(button?: HTMLElement) {
    const jsonText = jsonViewerContent.value || currentJsonForCopy.value;
    copyJsonFromModal(jsonText, button || null);
  }

  // Delete tenant function
  async function deleteTenant(tenantIdParam: string) {
    if (!confirm(`Вы уверены, что хотите удалить тенант "${tenantIdParam}"?`)) {
      return;
    }

    try {
      getApiKey(); // Проверка наличия ключа
      const baseUrl = configStore.config.TENANT_API_URL || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/tenants/${tenantIdParam}`, {
        method: 'DELETE',
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete tenant');
      }

      loadTenants(currentPage.value, currentLimit.value);
      alert('Тенант успешно удален!');
    } catch (err) {
      console.error('Error deleting tenant:', err);
      alert('Ошибка удаления тенанта: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  // URL modal functions
  function generateApiUrl() {
    const key = getApiKey();
    if (!key) {
      return 'API Key не указан';
    }

    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: currentLimit.value.toString(),
    });

    if (currentFilter.value) {
      params.append('filter', currentFilter.value);
    }

    const sortObj: Record<string, number> = {};
    sortObj[currentSort.value.field] = currentSort.value.order;
    params.append('sort', JSON.stringify(sortObj));

    const baseUrl = configStore.config.TENANT_API_URL || '/api';
    return `${baseUrl}/api/tenants?${params.toString()}`;
  }

  const fullUrl = computed(() => {
    const url = generateApiUrl();
    const key = getApiKey();
    if (!key) {
      return url;
    }
    return `${window.location.origin}${url}`;
  });

  function showUrlModal() {
    generatedUrl.value = generateApiUrl();
    urlModal.open();
    copyUrlButtonText.value = '📋 Скопировать';
  }

  async function copyUrlToClipboard() {
    const url = generateApiUrl();
    try {
      await navigator.clipboard.writeText(url);
      copyUrlButtonText.value = '✓ Скопировано!';
      setTimeout(() => {
        copyUrlButtonText.value = '📋 Скопировать';
      }, 2000);
    } catch (err) {
      console.error('Ошибка копирования:', err);
      alert('Не удалось скопировать URL');
    }
  }

  return {
    // Modals
    createModal,
    metaModal,
    infoModal,
    urlModal,
    // Создание тенанта
    createTenantId,
    createMetaTags,
    newMetaKey,
    newMetaValue,
    // Meta теги
    metaTenantId,
    metaTags,
    newMetaKeyForEdit,
    newMetaValueForEdit,
    // Info modal
    infoUrl,
    jsonViewerContent,
    copyJsonButtonText,
    // URL modal
    generatedUrl,
    copyUrlButtonText,
    fullUrl,
    // Functions
    showCreateModal,
    addCreateMetaTag,
    removeCreateMetaTag,
    createTenant,
    showMetaModal,
    closeMetaModal,
    loadMetaTags,
    addMetaTag,
    deleteMetaTag,
    showInfoModal,
    copyJsonToClipboard,
    deleteTenant,
    generateApiUrl,
    showUrlModal,
    copyUrlToClipboard,
  };
}
