import { onMounted } from 'vue';
import { getControlApiUrl, copyApiKey } from './useUtils';
import { useInit } from './useInit';
import { useSeed } from './useSeed';
import { useRecalculate } from './useRecalculate';
import { useReconcileDrift } from './useReconcileDrift';
import { useDedupeUpdates } from './useDedupeUpdates';

export function useInitPage() {
  // Инициализация
  const initModule = useInit(getControlApiUrl);
  const {
    initLoading,
    initResult,
    initialize,
  } = initModule;

  // Seed
  const seedModule = useSeed(getControlApiUrl);
  const {
    seedLoading,
    seedResult,
    runSeed,
  } = seedModule;

  // Полный пересчёт счетчиков
  const recalculateModule = useRecalculate(getControlApiUrl);
  const {
    fullRecalculateLoading,
    fullRecalculateResult,
    fullRecalculateStats,
  } = recalculateModule;

  const driftModule = useReconcileDrift(getControlApiUrl);
  const {
    reconcileDriftLoading,
    reconcileDriftResult,
    reconcileCounterDrift,
  } = driftModule;

  const dedupeModule = useDedupeUpdates(getControlApiUrl);
  const {
    dedupeUpdatesLoading,
    dedupeUpdatesResult,
    removeDuplicateUpdates,
  } = dedupeModule;

  // Делаем функцию копирования доступной глобально для вызова из v-html
  onMounted(() => {
    (window as any).copyApiKeyFromInit = copyApiKey;
  });

  return {
    initLoading,
    initResult,
    seedLoading,
    seedResult,
    fullRecalculateLoading,
    fullRecalculateResult,
    fullRecalculateStats,
    reconcileDriftLoading,
    reconcileDriftResult,
    reconcileCounterDrift,
    dedupeUpdatesLoading,
    dedupeUpdatesResult,
    removeDuplicateUpdates,
    initialize,
    runSeed,
  };
}
