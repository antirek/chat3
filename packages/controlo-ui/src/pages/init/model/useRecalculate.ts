/**
 * Модуль полного пересчёта счетчиков (пользователи + паки).
 */
import { ref } from 'vue';

export function useRecalculate(getControlApiUrl: (path?: string) => string) {
  const fullRecalculateLoading = ref(false);
  const fullRecalculateResult = ref<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    content: string;
  }>({
    show: false,
    type: 'info',
    content: ''
  });

  async function fullRecalculateStats() {
    const confirmed = confirm(
      'Выполнить полный пересчёт счетчиков (UserStats для всех пользователей + счетчики паков для всех паков) во всех тенантах?\n\n' +
        'Операция выполняется в фоне и может занять длительное время.'
    );
    if (!confirmed) return;

    fullRecalculateLoading.value = true;
    fullRecalculateResult.value = { show: false, type: 'info', content: '' };

    try {
      const url = getControlApiUrl('/api/init/full-recalculate-stats');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Ответ: ${text.substring(0, 200)}`);
      }
      const data = await response.json();

      if (response.ok || response.status === 202) {
        fullRecalculateResult.value = {
          show: true,
          type: 'info',
          content: `
            <strong>⏳ Полный пересчёт запущен</strong>
            <p style="margin-top: 10px;">${data.message || ''}</p>
            <p style="margin-top: 10px; font-size: 12px; color: #6c757d;">
              ${data.data?.note || 'Операция выполняется в фоне. Проверьте логи сервера для отслеживания прогресса.'}
            </p>
            <p style="margin-top: 10px; font-size: 12px; color: #856404;">
              ⚠️ Пересчёт выполняется для всех пользователей и паков во всех тенантах. Это может занять некоторое время.
            </p>
          `
        };
      } else {
        fullRecalculateResult.value = {
          show: true,
          type: 'error',
          content: `<strong>❌ Ошибка запуска пересчёта</strong><pre>${JSON.stringify(data, null, 2)}</pre>`
        };
      }
    } catch (error: any) {
      fullRecalculateResult.value = {
        show: true,
        type: 'error',
        content: `<strong>❌ Ошибка запроса</strong><p>${error.message}</p>`
      };
    } finally {
      fullRecalculateLoading.value = false;
    }
  }

  return {
    fullRecalculateLoading,
    fullRecalculateResult,
    fullRecalculateStats
  };
}
