/**
 * Утилиты для формирования HTML контента модальных окон
 */
import { escapeHtml } from './string';

/**
 * Формирует HTML контент для модального окна с кнопками копирования
 * @param content - основной контент модального окна
 * @param url - URL для отображения (опционально)
 * @param jsonContent - JSON контент для отображения (опционально)
 * @returns HTML строка с добавленными кнопками копирования
 */
export function buildModalContentWithCopyButtons(
  content: string,
  url: string | null = null,
  jsonContent: any = null,
): string {
  let modalContent = '';

  // Добавляем URL с кнопкой копирования
  if (url) {
    modalContent += `<div class="info-url-wrapper" style="margin-bottom: 15px; position: relative;">
      <div class="info-url" style="padding: 8px; padding-right: 35px; background: #f8f9fa; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; color: #495057;">${escapeHtml(url)}</div>
      <button type="button" class="copy-url-btn" data-url="${escapeHtml(url).replace(/"/g, '&quot;')}" onclick="copyUrlFromModal(this)" title="Копировать URL">📋</button>
    </div>`;
  }

  modalContent += content;

  // Добавляем JSON контент с кнопкой копирования
  if (jsonContent) {
    const jsonStr = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent, null, 2);
    
    // Находим json-content в content и добавляем кнопку копирования
    if (content.includes('json-content')) {
      // Обертываем json-content в контейнер с кнопкой
      // Заменяем открывающий тег с классом json-content
      modalContent = modalContent.replace(
        /(<(?:div|pre)[^>]*class="json-content"[^>]*>)/,
        '<div class="json-content-wrapper" style="position: relative;">$1'
      );
      // Находим закрывающий тег json-content (div или pre) и добавляем кнопку перед ним
      const wrapperIndex = modalContent.indexOf('json-content-wrapper');
      if (wrapperIndex !== -1) {
        // Находим содержимое после обертки
        const afterWrapper = modalContent.substring(wrapperIndex);
        // Ищем закрывающий тег div или pre
        const closingTagMatch = afterWrapper.match(/(<\/(?:div|pre)>)/);
        if (closingTagMatch && !modalContent.includes('copy-json-btn')) {
          const closingTagIndex = afterWrapper.indexOf(closingTagMatch[0]);
          const insertPos = wrapperIndex + closingTagIndex + closingTagMatch[0].length;
          const before = modalContent.substring(0, insertPos);
          const after = modalContent.substring(insertPos);
          modalContent = before + '<button type="button" class="copy-json-btn" onclick="copyJsonToClipboardFromModal(this)" title="Копировать JSON">📋</button></div>' + after;
        }
      }
      // Если кнопка все еще не добавлена, используем простую замену
      if (!modalContent.includes('copy-json-btn')) {
        // Находим первый закрывающий тег после json-content-wrapper
        modalContent = modalContent.replace(
          /(<\/(?:div|pre)>)(\s*)(?=<div class="form-actions"|<\/div>|$)/,
          '$1<button type="button" class="copy-json-btn" onclick="copyJsonToClipboardFromModal(this)" title="Копировать JSON">📋</button></div>$2'
        );
      }
    } else {
      // Если json-content не найден в content, добавляем его с кнопкой
      modalContent += `<div class="json-content-wrapper" style="position: relative;">
        <div class="json-content">${escapeHtml(jsonStr)}</div>
        <button type="button" class="copy-json-btn" onclick="copyJsonToClipboardFromModal(this)" title="Копировать JSON">📋</button>
      </div>`;
    }
  }

  return modalContent;
}
