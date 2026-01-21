import { ref, type Ref } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getTenantApiUrl } from '@/shared/lib/utils/url';

export function useDialogs(selectedUserId: Ref<string | null>) {
  const credentialsStore = useCredentialsStore();

  const loadingDialogs = ref(false);
  const dialogsError = ref<string | null>(null);
  const dialogs = ref<any[]>([]);

  async function loadDialogs() {
    if (!selectedUserId.value) {
      dialogs.value = [];
      return;
    }

    try {
      loadingDialogs.value = true;
      dialogsError.value = null;

      const url = getTenantApiUrl(`/api/users/${selectedUserId.value}/dialogs?limit=50`);
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      dialogs.value = data.data || [];
    } catch (error: any) {
      console.error('Error loading dialogs:', error);
      dialogsError.value = error.message || 'Ошибка загрузки диалогов';
      dialogs.value = [];
    } finally {
      loadingDialogs.value = false;
    }
  }

  return {
    loadingDialogs,
    dialogsError,
    dialogs,
    loadDialogs,
  };
}
