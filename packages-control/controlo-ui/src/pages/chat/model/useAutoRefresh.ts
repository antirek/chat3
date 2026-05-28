import { ref, onBeforeUnmount, watch, type Ref } from 'vue';

export type AutoRefreshInterval = 0 | 3 | 5 | 10 | 30;

export const AUTO_REFRESH_OPTIONS: { value: AutoRefreshInterval; label: string }[] = [
  { value: 0, label: 'Выкл' },
  { value: 3, label: '3 сек' },
  { value: 5, label: '5 сек' },
  { value: 10, label: '10 сек' },
  { value: 30, label: '30 сек' },
];

export function useAutoRefresh(
  interval: Ref<AutoRefreshInterval>,
  refreshFn: () => Promise<void> | void,
  enabled: Ref<boolean> = ref(true)
) {
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  function startRefresh() {
    stopRefresh();

    if (interval.value === 0 || !enabled.value) {
      return;
    }

    refreshTimer = setInterval(() => {
      if (enabled.value) {
        refreshFn();
      }
    }, interval.value * 1000);
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // Автоматически запускаем/останавливаем при изменении интервала
  watch([interval, enabled], () => {
    if (interval.value > 0 && enabled.value) {
      startRefresh();
    } else {
      stopRefresh();
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    stopRefresh();
  });

  return {
    startRefresh,
    stopRefresh,
  };
}
