/* eslint-env browser */
/* global alert, confirm */
import { ref, onMounted } from 'vue';
import { useConfigStore } from '@/app/stores/config';

export function useInitPage() {
  // Stores
  const configStore = useConfigStore();

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

  // State для seed
  const seedLoading = ref(false);
  const seedResult = ref<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    content: string;
  }>({
    show: false,
    type: 'info',
    content: ''
  });

  // State для пересчета счетчиков
  const recalculateLoading = ref(false);
  const recalculateResult = ref<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    content: string;
  }>({
    show: false,
    type: 'info',
    content: ''
  });

  // Функция для получения URL control-api
  function getControlApiUrl(path = ''): string {
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
  async function copyApiKey(apiKey: string) {
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
    } catch (error) {
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
      } catch (err) {
        alert('Не удалось скопировать ключ. Скопируйте вручную: ' + apiKey);
      }
      document.body.removeChild(textArea);
    }
  }

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

  // Заполнение тестовыми данными
  async function runSeed() {
    // Подтверждение перед запуском seed
    const confirmed = confirm(
      '⚠️ Внимание!\n\n' +
      'Скрипт seed очистит все существующие данные (пользователи, диалоги, сообщения и т.д.) ' +
      'и заполнит базу тестовыми данными.\n\n' +
      'Продолжить?'
    );

    if (!confirmed) {
      return;
    }

    seedLoading.value = true;
    seedResult.value = {
      show: false,
      type: 'info',
      content: ''
    };

    try {
      const url = getControlApiUrl('/api/init/seed');
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

      if (response.ok || response.status === 202) {
        seedResult.value = {
          show: true,
          type: 'info',
          content: `
            <pre>${JSON.stringify(data, null, 2)}</pre>
          `
        };
      } else {
        seedResult.value = {
          show: true,
          type: 'error',
          content: `
            <strong>❌ Ошибка запуска seed</strong>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          `
        };
      }
    } catch (error: any) {
      seedResult.value = {
        show: true,
        type: 'error',
        content: `
          <strong>❌ Ошибка запроса</strong>
          <p>${error.message}</p>
        `
      };
    } finally {
      seedLoading.value = false;
    }
  }

  // Пересчет счетчиков пользователей
  async function recalculateUserStats() {
    // Подтверждение перед запуском пересчета
    const confirmed = confirm(
      '⚠️ Внимание!\n\n' +
      'Будет выполнен пересчет всех счетчиков пользователей (dialogCount, unreadDialogsCount, totalUnreadCount, totalMessagesCount) ' +
      'для всех пользователей во всех тенантах.\n\n' +
      'Операция может занять некоторое время в зависимости от количества пользователей.\n\n' +
      'Продолжить?'
    );

    if (!confirmed) {
      return;
    }

    recalculateLoading.value = true;
    recalculateResult.value = {
      show: false,
      type: 'info',
      content: ''
    };

    try {
      const url = getControlApiUrl('/api/init/recalculate-stats');
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

      if (response.ok || response.status === 202) {
        recalculateResult.value = {
          show: true,
          type: 'info',
          content: `
            <strong>⏳ Пересчет счетчиков запущен</strong>
            <p style="margin-top: 10px;">${data.message || ''}</p>
            <p style="margin-top: 10px; font-size: 12px; color: #6c757d;">
              ${data.data?.note || 'Операция выполняется в фоне. Проверьте логи сервера для отслеживания прогресса.'}
            </p>
            <p style="margin-top: 10px; font-size: 12px; color: #856404;">
              ⚠️ Пересчет выполняется для всех пользователей во всех тенантах. Это может занять некоторое время.
            </p>
          `
        };
      } else {
        recalculateResult.value = {
          show: true,
          type: 'error',
          content: `
            <strong>❌ Ошибка запуска пересчета</strong>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          `
        };
      }
    } catch (error: any) {
      recalculateResult.value = {
        show: true,
        type: 'error',
        content: `
          <strong>❌ Ошибка запроса</strong>
          <p>${error.message}</p>
        `
      };
    } finally {
      recalculateLoading.value = false;
    }
  }

  // Делаем функцию копирования доступной глобально для вызова из v-html
  onMounted(() => {
    (window as any).copyApiKeyFromInit = copyApiKey;
  });

  return {
    initLoading,
    initResult,
    seedLoading,
    seedResult,
    recalculateLoading,
    recalculateResult,
    initialize,
    runSeed,
    recalculateUserStats,
  };
}
