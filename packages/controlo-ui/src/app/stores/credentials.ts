import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useCredentialsStore = defineStore('credentials', () => {
  const apiKey = ref('');
  const tenantId = ref('tnt_default');

  // Загрузка из localStorage
  function loadFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const savedApiKey = window.localStorage.getItem('apiKey');
    const savedTenantId = window.localStorage.getItem('tenantId') || 'tnt_default';

    if (savedApiKey) {
      apiKey.value = savedApiKey;
    }
    tenantId.value = savedTenantId;
  }

  // Сохранение в localStorage
  function saveToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (apiKey.value.trim()) {
      window.localStorage.setItem('apiKey', apiKey.value.trim());
    }
    window.localStorage.setItem('tenantId', tenantId.value || 'tnt_default');
  }

  // Установка credentials
  function setCredentials(newApiKey: string, newTenantId?: string) {
    apiKey.value = newApiKey;
    if (newTenantId) {
      tenantId.value = newTenantId;
    }
    saveToStorage();
  }

  // Получение headers для API запросов
  function getHeaders() {
    if (!apiKey.value) {
      throw new Error('API Key не указан');
    }
    return {
      'X-API-Key': apiKey.value,
      'X-Tenant-ID': tenantId.value,
    };
  }

  // Автосохранение при изменении
  watch(apiKey, () => {
    saveToStorage();
  });

  watch(tenantId, () => {
    saveToStorage();
  });

  // Инициализация при создании store
  loadFromStorage();

  return {
    apiKey,
    tenantId,
    loadFromStorage,
    saveToStorage,
    setCredentials,
    getHeaders,
  };
});
