/**
 * Модуль утилит для страницы init
 * Отвечает за: получение URL control-api, копирование API ключа
 */
import { getControlApiUrl } from '@/shared/lib/utils/url';

export { getControlApiUrl };

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
