/**
 * Утилиты страницы паков: URL-параметры, установка credentials извне
 */
import type { Ref } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getUrlParams } from '@/shared/lib/utils/url';

export function useUtils(
  credentialsStore: ReturnType<typeof useCredentialsStore>,
  apiKey: Ref<string>,
  tenantId: Ref<string>,
  loadPacks: (page?: number, limit?: number) => Promise<void>,
) {
  function setApiKeyFromExternal(extApiKey: string, extTenantId?: string) {
    if (!extApiKey) return;
    credentialsStore.setCredentials(extApiKey, extTenantId);
    loadPacks(1);
  }

  return {
    getUrlParams,
    setApiKeyFromExternal,
  };
}
