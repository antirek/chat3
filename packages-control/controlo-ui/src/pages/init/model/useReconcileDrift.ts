/**
 * Сверка drift счётчиков (read-only отчёт).
 */
import { ref } from 'vue';

export function useReconcileDrift(getControlApiUrl: (path?: string) => string) {
  const reconcileDriftLoading = ref(false);
  const reconcileDriftResult = ref<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    content: string;
  }>({
    show: false,
    type: 'info',
    content: ''
  });

  async function reconcileCounterDrift() {
    reconcileDriftLoading.value = true;
    reconcileDriftResult.value = { show: false, type: 'info', content: '' };

    try {
      const url = getControlApiUrl('/api/init/reconcile-counter-drift');
      const response = await fetch(url);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Сервер вернул не JSON. Status: ${response.status}. Ответ: ${text.substring(0, 200)}`);
      }
      const data = await response.json();
      const report = data.data;
      const driftList = (report?.drifts ?? [])
        .slice(0, 20)
        .map(
          (d: Record<string, unknown>) =>
            `<li><code>${d.kind}</code> ${d.userId ?? ''} ${d.dialogId ?? ''} ${d.messageId ?? ''}: stored=${d.stored}, expected=${d.expected}</li>`
        )
        .join('');

      if (response.ok) {
        reconcileDriftResult.value = {
          show: true,
          type: 'success',
          content: `
            <strong>✅ Drift не обнаружен</strong>
            <p style="margin-top: 10px;">Проверено пар user/dialog: ${report?.checkedUserDialogs ?? 0},
              message status: ${report?.checkedMessageStatus ?? 0},
              user stats: ${report?.checkedUserStats ?? 0}</p>
          `
        };
      } else {
        reconcileDriftResult.value = {
          show: true,
          type: 'error',
          content: `
            <strong>⚠️ Обнаружен drift (${report?.driftCount ?? '?'})</strong>
            <ul style="margin-top: 10px; font-size: 13px;">${driftList || '<li>нет деталей</li>'}</ul>
            <p style="margin-top: 10px; font-size: 12px; color: #856404;">
              Запустите «Полный пересчёт» или <code>npm run reconcile-counter-drift</code> для CI.
            </p>
          `
        };
      }
    } catch (error: any) {
      reconcileDriftResult.value = {
        show: true,
        type: 'error',
        content: `<strong>❌ Ошибка запроса</strong><p>${error.message}</p>`
      };
    } finally {
      reconcileDriftLoading.value = false;
    }
  }

  return {
    reconcileDriftLoading,
    reconcileDriftResult,
    reconcileCounterDrift
  };
}
