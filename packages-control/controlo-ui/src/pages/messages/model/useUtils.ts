/**
 * Модуль утилит для страницы messages
 * Отвечает за: работа с URL параметрами, установка API ключа извне
 */
import type { Ref } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getUrlParams } from '@/shared/lib/utils/url';

export function useUtils(
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  apiKey: Ref<string>,
  tenantId: Ref<string>,
  loadMessages: (page?: number) => Promise<void>,
) {
  // Функции для работы с API ключом
  function setApiKeyFromExternal(extApiKey: string, extTenantId?: string) {
    if (!extApiKey) {
      console.warn('API Key не предоставлен');
      return;
    }

    credentialsStore.setCredentials(extApiKey, extTenantId);

    console.log('API Key set from external:', apiKey.value);
    console.log('Tenant ID set from external:', tenantId.value);

    loadMessages(1);
  }

  return {
    getUrlParams,
    setApiKeyFromExternal,
  };
}
