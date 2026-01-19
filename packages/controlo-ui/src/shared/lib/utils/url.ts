/**
 * Утилиты для работы с URL
 */
import { useConfigStore } from '@/app/stores/config';

/**
 * Получает параметры apiKey и tenantId из URL
 * @returns Объект с apiKey и tenantId (по умолчанию tenantId = 'tnt_default')
 */
export function getUrlParams(): { apiKey: string; tenantId: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    apiKey: params.get('apiKey') || '',
    tenantId: params.get('tenantId') || 'tnt_default',
  };
}

/**
 * Получает URL для Control API
 * @param path - путь для добавления к базовому URL
 * @returns Полный URL для Control API
 */
export function getControlApiUrl(path = ''): string {
  // Сначала проверяем глобальный CHAT3_CONFIG (если есть)
  if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG?.getControlApiUrl) {
    return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
  }
  
  // Используем configStore как источник истины
  const configStore = useConfigStore();
  const controlApiUrl = configStore.config.CONTROL_APP_URL || 'http://localhost:3003';
  return `${controlApiUrl}${path}`;
}
