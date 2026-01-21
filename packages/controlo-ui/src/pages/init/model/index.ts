import { onMounted } from 'vue';
import { getControlApiUrl, copyApiKey } from './useUtils';
import { useInit } from './useInit';
import { useSeed } from './useSeed';
import { useRecalculate } from './useRecalculate';

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

  // Пересчет счетчиков
  const recalculateModule = useRecalculate(getControlApiUrl);
  const {
    recalculateLoading,
    recalculateResult,
    recalculateUserStats,
  } = recalculateModule;

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
