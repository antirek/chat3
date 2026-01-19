/**
 * Утилиты для работы с API
 * Отвечает за: формирование URL для Control API
 */
export function getControlApiUrl(path = ''): string {
  if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG) {
    return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
  }
  const currentProtocol = window.location.protocol;
  const currentHost = window.location.host;
  const controlApiUrl = currentHost.includes(':3001') || !currentHost.includes(':') 
    ? `${currentProtocol}//${currentHost}` 
    : `${currentProtocol}//${currentHost.split(':')[0]}:3002`;
  return `${controlApiUrl}${path}`;
}
