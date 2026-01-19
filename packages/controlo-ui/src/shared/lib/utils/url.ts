/**
 * Утилиты для работы с URL
 */

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
