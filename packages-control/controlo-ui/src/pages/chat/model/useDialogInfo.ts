import { ref } from 'vue';
import { getTenantApiUrl } from '@/shared/lib/utils/url';
import { useCredentialsStore } from '@/app/stores/credentials';

export function useDialogInfo() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const dialogData = ref<any | null>(null);

  async function loadDialogInfo(dialogId: string): Promise<any | null> {
    loading.value = true;
    error.value = null;
    dialogData.value = null;

    try {
      const credentialsStore = useCredentialsStore();
      const url = getTenantApiUrl(`/api/dialogs/${dialogId}`);
      
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      dialogData.value = data.data;
      return data.data;
    } catch (err: any) {
      error.value = err.message || 'Ошибка загрузки данных диалога';
      console.error('Error loading dialog info:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    dialogData.value = null;
    error.value = null;
  }

  return {
    loading,
    error,
    dialogData,
    loadDialogInfo,
    clear,
  };
}
