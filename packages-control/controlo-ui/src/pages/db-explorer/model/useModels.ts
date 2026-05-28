/**
 * Модуль работы с моделями базы данных
 * Отвечает за: загрузку списка моделей, выбор модели, обновление данных
 */
import { ref, Ref } from 'vue';
import { getControlApiUrl } from './useUtils';

interface UseModelsDependencies {
  currentModel: Ref<string | null>;
  filters: Ref<Record<string, any>>;
  originalData: Ref<any[]>;
  pagination: {
    setPage: (page: number) => void;
  };
  loadModelData: () => Promise<void>;
}

export function useModels(deps: UseModelsDependencies) {
  const { currentModel, filters, originalData, pagination, loadModelData } = deps;

  // State для моделей
  const loadingModels = ref(false);
  const modelsError = ref<string | null>(null);
  const modelsByCategory = ref<Record<string, any[]>>({});

  async function loadModels() {
    loadingModels.value = true;
    modelsError.value = null;
    try {
      const response = await fetch(getControlApiUrl('/api/db-explorer/models'));
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load models: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      
      if (!result.data || typeof result.data !== 'object') {
        throw new Error('Invalid data format received from server');
      }
      
      modelsByCategory.value = result.data;
    } catch (error: any) {
      modelsError.value = error.message;
      console.error('Error loading models:', error);
    } finally {
      loadingModels.value = false;
    }
  }

  function selectModel(modelName: string) {
    currentModel.value = modelName;
    pagination.setPage(1);
    filters.value = {};
    originalData.value = [];
    loadModelData();
  }

  function refreshModelData() {
    if (!currentModel.value) return;
    filters.value = {};
    pagination.setPage(1);
    originalData.value = [];
    loadModelData();
  }

  return {
    loadingModels,
    modelsError,
    modelsByCategory,
    loadModels,
    selectModel,
    refreshModelData,
  };
}
