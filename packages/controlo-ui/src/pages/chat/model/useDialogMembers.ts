import { ref, type Ref, watch } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getTenantApiUrl } from '@/shared/lib/utils/url';

export function useDialogMembers(selectedDialogId: Ref<string | null>) {
  const credentialsStore = useCredentialsStore();
  
  const loading = ref(false);
  const error = ref<string | null>(null);
  const members = ref<any[]>([]);

  async function loadMembers(dialogId: string) {
    if (!dialogId || typeof dialogId !== 'string' || dialogId.trim().length === 0) {
      console.warn('loadMembers called with invalid dialogId:', dialogId);
      clear();
      return;
    }
    
    loading.value = true;
    error.value = null;
    members.value = [];

    try {
      const url = getTenantApiUrl(`/api/dialogs/${dialogId}/members?limit=100&sort=(joinedAt,asc)`);
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      members.value = data.data || [];
    } catch (err: any) {
      error.value = err.message || 'Ошибка загрузки участников';
      console.error('Error loading dialog members:', err);
      members.value = [];
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    members.value = [];
    error.value = null;
  }

  // Автоматически загружаем участников при изменении выбранного диалога
  watch(selectedDialogId, (dialogId) => {
    if (dialogId && typeof dialogId === 'string' && dialogId.trim().length > 0) {
      loadMembers(dialogId);
    } else {
      clear();
    }
  }, { immediate: false }); // Не запускаем сразу, чтобы избежать загрузки с undefined

  return {
    loading,
    error,
    members,
    loadMembers,
    clear,
  };
}
