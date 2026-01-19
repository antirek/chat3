import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useCredentialsStore = defineStore('credentials', () => {
  const apiKey = ref('');
  const tenantId = ref('tnt_default');
  // Флаг для уведомления страниц о том, что credentials были применены
  const credentialsApplied = ref(false);

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

  // Применение credentials (вызывается при нажатии на галочку)
  function applyCredentials() {
    saveToStorage();
    credentialsApplied.value = true;
    // Генерируем событие для уведомления страниц
    if (typeof window !== 'undefined' && window.CustomEvent) {
      window.dispatchEvent(new window.CustomEvent('credentials-applied', {
        detail: { apiKey: apiKey.value, tenantId: tenantId.value }
      }));
    }
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

  // Флаг для отслеживания инициализации
  let isInitialized = false;

  // Автосохранение при изменении (но не устанавливаем applied)
  // Флаг applied сбрасывается в checkForChanges() в AppLayout при каждом input
  watch(apiKey, () => {
    // Пропускаем первое изменение (инициализация)
    if (!isInitialized) {
      isInitialized = true;
      return;
    }
    saveToStorage();
    // Не сбрасываем флаг здесь - это делает checkForChanges() в AppLayout
  });

  watch(tenantId, () => {
    // Пропускаем первое изменение (инициализация)
    if (!isInitialized) {
      isInitialized = true;
      return;
    }
    saveToStorage();
    // Не сбрасываем флаг здесь - это делает checkForChanges() в AppLayout
  });

  // Инициализация при создании store
  loadFromStorage();

  return {
    apiKey,
    tenantId,
    credentialsApplied,
    loadFromStorage,
    saveToStorage,
    setCredentials,
    applyCredentials,
    getHeaders,
  };
});
