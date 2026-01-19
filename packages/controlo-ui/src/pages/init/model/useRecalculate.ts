/**
 * Модуль пересчета счетчиков пользователей
 * Отвечает за: пересчет всех счетчиков пользователей (dialogCount, unreadDialogsCount, totalUnreadCount, totalMessagesCount)
 */
import { ref } from 'vue';

export function useRecalculate(getControlApiUrl: (path?: string) => string) {
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

  return {
    recalculateLoading,
    recalculateResult,
    recalculateUserStats,
  };
}
