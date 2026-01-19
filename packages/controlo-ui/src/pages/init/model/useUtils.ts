/**
 * Модуль утилит для страницы init
 * Отвечает за: получение URL control-api, копирование API ключа
 */

// Функция для получения URL control-api
export function getControlApiUrl(path = ''): string {
  if (typeof window !== 'undefined' && (window as any).CHAT3_CONFIG) {
    return (window as any).CHAT3_CONFIG.getControlApiUrl(path);
  }
  // Fallback для development
  const currentProtocol = window.location.protocol;
  const currentHost = window.location.host;
  const controlApiUrl = currentHost.includes(':3001') || !currentHost.includes(':') 
    ? `${currentProtocol}//${currentHost}` 
    : `${currentProtocol}//${currentHost.split(':')[0]}:3002`;
  return `${controlApiUrl}${path}`;
}

// Функция копирования API ключа
export async function copyApiKey(apiKey: string) {
  try {
    await navigator.clipboard.writeText(apiKey);
    const btn = document.getElementById('copyBtn');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ Скопировано!';
      btn.classList.add('copy-success');
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('copy-success');
      }, 2000);
    }
  } catch {
    // Fallback для старых браузеров
    const textArea = document.createElement('textarea');
    textArea.value = apiKey;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      const btn = document.getElementById('copyBtn');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Скопировано!';
        btn.classList.add('copy-success');
        
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('copy-success');
        }, 2000);
      }
    } catch {
      alert('Не удалось скопировать ключ. Скопируйте вручную: ' + apiKey);
    }
    document.body.removeChild(textArea);
  }
}
