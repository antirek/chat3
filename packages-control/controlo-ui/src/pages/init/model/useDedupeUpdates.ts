/**
 * Удаление дубликатов updates и создание уникального индекса.
 */
import { ref } from 'vue';

export function useDedupeUpdates(getControlApiUrl: (path?: string) => string) {
  const dedupeUpdatesLoading = ref(false);
  const dedupeUpdatesResult = ref<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    detail: string;
  }>({
    show: false,
    type: 'info',
    title: '',
    detail: ''
  });

  async function removeDuplicateUpdates() {
    const confirmed = confirm(
      'Удалить дубликаты updates?\n\n' +
        'На ключ (tenant, event, user, updateType, entity) останется один документ: опубликованный, иначе самый ранний.\n' +
        'После очистки будет создан уникальный индекс.'
    );
    if (!confirmed) return;

    dedupeUpdatesLoading.value = true;
    dedupeUpdatesResult.value = { show: false, type: 'info', title: '', detail: '' };

    try {
      const url = getControlApiUrl('/api/init/dedupe-updates');
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
      const report = data.data ?? {};
      const groups = report.duplicateGroups ?? 0;
      const deleted = report.deleted ?? 0;
      const indexNote = report.indexCreated
        ? 'Уникальный индекс создан.'
        : `Индекс не создан: ${report.indexError || data.message || 'неизвестная ошибка'}`;

      dedupeUpdatesResult.value = {
        show: true,
        type: response.ok ? 'success' : 'error',
        title: response.ok ? 'Дубликаты updates удалены' : 'Дубликаты удалены, индекс не создан',
        detail: `Групп с повторами: ${groups}. Удалено документов: ${deleted}. ${indexNote}`
      };
    } catch (error: any) {
      dedupeUpdatesResult.value = {
        show: true,
        type: 'error',
        title: 'Ошибка запроса',
        detail: error.message
      };
    } finally {
      dedupeUpdatesLoading.value = false;
    }
  }

  return {
    dedupeUpdatesLoading,
    dedupeUpdatesResult,
    removeDuplicateUpdates
  };
}
