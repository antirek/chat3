/**
 * Модуль seed для заполнения тестовыми данными
 * Отвечает за: запуск seed скрипта для заполнения базы тестовыми данными
 */
import { ref } from 'vue';

export function useSeed(getControlApiUrl: (path?: string) => string) {
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

  return {
    seedLoading,
    seedResult,
    runSeed,
  };
}
