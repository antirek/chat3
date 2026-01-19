/**
 * Модуль утилит для работы с API и форматированием
 * Отвечает за: формирование URL для Control API, получение tenantId, форматирование timestamp
 */
import { toRef } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';

export function getControlApiUrl(path = ''): string {
  const configStore = useConfigStore();
  if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG && (window as any).CHAT3_CONFIG.getControlApiUrl) {
    return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
  }
  const controlApiUrl = configStore.config.CONTROL_APP_URL || 'http://localhost:3001';
  return `${controlApiUrl}${path}`;
}

export function getTenantId(credentialsStore: ReturnType<typeof useCredentialsStore>): string {
  const tenantId = toRef(credentialsStore, 'tenantId');
  return tenantId.value || 'tnt_default';
}

export function formatTimestamp(ts: string | number | null | undefined): string {
  if (!ts) return '-';
  const timestamp = typeof ts === 'string' ? parseFloat(ts) : ts;
  const date = new Date(Math.floor(timestamp));
  return date.toLocaleString('ru-RU');
}
