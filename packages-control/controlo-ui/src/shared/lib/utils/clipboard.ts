/**
 * Утилиты для работы с буфером обмена
 */

/**
 * Копирует текст в буфер обмена и обновляет состояние кнопки
 * @param text - текст для копирования
 * @param button - элемент кнопки для обновления состояния (опционально)
 * @param successText - текст для отображения при успешном копировании (по умолчанию '✅')
 * @param errorMessage - сообщение об ошибке (по умолчанию 'Не удалось скопировать')
 */
export function copyToClipboardWithFeedback(
  text: string,
  button?: HTMLElement | null,
  successText: string = '✅',
  errorMessage: string = 'Не удалось скопировать',
): Promise<void> {
  return navigator.clipboard.writeText(text).then(
    () => {
      if (button) {
        const originalText = button.textContent;
        button.textContent = successText;
        setTimeout(() => {
          if (button) {
            button.textContent = originalText;
          }
        }, 2000);
      }
    },
    (err) => {
      console.error('Failed to copy to clipboard:', err);
      alert(errorMessage);
    },
  );
}

/**
 * Копирует URL из модального окна (будет вызвана из v-html)
 * @param button - элемент кнопки или строка URL (для обратной совместимости)
 */
export function copyUrlFromModal(button: HTMLElement | string | any): void {
  let url: string;
  let buttonElement: HTMLElement | null = null;
  
  if (typeof button === 'string') {
    // Для обратной совместимости
    url = button;
    buttonElement = document.querySelector('.copy-url-btn');
  } else if (button && typeof button.getAttribute === 'function') {
    // Читаем URL из data-атрибута
    buttonElement = button as HTMLElement;
    url = button.getAttribute('data-url') || '';
  } else {
    alert('Некорректный параметр button');
    return;
  }

  if (!url) {
    alert('URL не найден');
    return;
  }

  copyToClipboardWithFeedback(url, buttonElement, '✅', 'Не удалось скопировать URL');
}

/**
 * Копирует JSON из модального окна (будет вызвана из v-html)
 * @param jsonText - JSON текст для копирования
 * @param button - элемент кнопки для обновления состояния (опционально)
 */
export function copyJsonFromModal(jsonText: string | null, button?: HTMLElement | null): void {
  if (!jsonText) {
    alert('Нет данных для копирования');
    return;
  }

  copyToClipboardWithFeedback(jsonText, button || null, '✅', 'Не удалось скопировать JSON');
}
