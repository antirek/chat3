/**
 * Модуль утилит для работы с API и форматированием
 * Отвечает за: формирование URL для Control API, получение tenantId, форматирование timestamp
 */
import { toRef } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { formatTimestamp } from '@/shared/lib/utils/date';
import { getControlApiUrl } from '@/shared/lib/utils/url';

export function getTenantId(credentialsStore: ReturnType<typeof useCredentialsStore>): string {
  const tenantId = toRef(credentialsStore, 'tenantId');
  return tenantId.value || 'tnt_default';
}

export { formatTimestamp, getControlApiUrl };
