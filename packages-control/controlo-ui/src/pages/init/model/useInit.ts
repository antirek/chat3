/**
 * Модуль инициализации системы
 * Отвечает за: инициализацию базы данных, создание базового tenant и API ключа
 */
import { ref } from 'vue';

export function useInit(getControlApiUrl: (path?: string) => string) {
  // State для инициализации
  const initLoading = ref(false);
  const initResult = ref<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    content: string;
  }>({
    show: false,
    type: 'success',
    content: ''
  });

  // Инициализация системы
  async function initialize() {
    // Подтверждение перед инициализацией
    const confirmed = confirm(
      '⚠️ ВНИМАНИЕ!\n\n' +
      'Инициализация удалит ВСЕ данные из базы данных:\n' +
      '- Все пользователи\n' +
      '- Все диалоги\n' +
      '- Все сообщения\n' +
      '- Все API ключи\n' +
      '- Все tenant\n' +
      '- И все остальные данные\n\n' +
      'После удаления будет создан базовый tenant и новый API ключ.\n\n' +
      'Продолжить?'
    );

    if (!confirmed) {
      return;
    }

    initLoading.value = true;
    initResult.value = {
      show: false,
      type: 'success',
      content: ''
    };

    try {
      const url = getControlApiUrl('/api/init');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Проверяем Content-Type перед парсингом JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Ответ: ${text.substring(0, 200)}`);
      }

      const data = await response.json();

      if (response.ok || response.status === 207) {
        let html = '<strong>✅ Инициализация завершена успешно</strong>';
        
        if (data.data && data.data.tenant && data.data.tenant.created) {
          html += `<p style="margin-top: 10px;"><strong>Tenant:</strong> ${data.data.tenant.tenantId}</p>`;
        }
        
        // Показываем API ключ в удобном виде для копирования
        if (data.data && data.data.apiKey && data.data.apiKey.key) {
          const apiKey = data.data.apiKey.key;
          html += `
            <div class="api-key-display">
              <h3>🔑 API ключ создан - скопируйте и сохраните его!</h3>
              <div class="api-key-value">
                <code id="apiKeyValue">${apiKey}</code>
                <button class="copy-btn" onclick="window.copyApiKeyFromInit('${apiKey.replace(/'/g, "\\'")}')" id="copyBtn">
                  📋 Копировать
                </button>
              </div>
              <p style="font-size: 12px; color: #856404; margin: 0;">
                ⚠️ Этот ключ больше не будет показан. Обязательно сохраните его!
              </p>
            </div>
          `;
        }
        
        // Информация о seed
        if (data.data && data.data.seed && data.data.seed.started) {
          html += `
            <div style="margin-top: 15px; padding: 10px; background: #d1ecf1; border-radius: 4px; border: 1px solid #bee5eb;">
              <strong>🌱 Seed скрипт запущен</strong>
              <p style="margin: 5px 0 0 0; font-size: 13px;">
                База данных заполняется тестовыми данными (несколько тенантов, пользователи, диалоги, сообщения).
                <br>Это может занять некоторое время. Проверьте логи сервера для отслеживания прогресса.
              </p>
            </div>
          `;
        }
        
        if (data.data && data.data.errors && data.data.errors.length > 0) {
          html += `<p style="margin-top: 10px; color: #856404;"><strong>Предупреждения:</strong></p>`;
          html += `<ul style="margin-top: 5px; color: #856404;">`;
          data.data.errors.forEach((error: string) => {
            html += `<li>${error}</li>`;
          });
          html += `</ul>`;
        }
        
        initResult.value = {
          show: true,
          type: 'success',
          content: html
        };
      } else {
        initResult.value = {
          show: true,
          type: 'error',
          content: `
            <strong>❌ Ошибка инициализации</strong>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          `
        };
      }
    } catch (error: any) {
      initResult.value = {
        show: true,
        type: 'error',
        content: `
          <strong>❌ Ошибка запроса</strong>
          <p>${error.message}</p>
        `
      };
    } finally {
      initLoading.value = false;
    }
  }

  return {
    initLoading,
    initResult,
    initialize,
  };
}
