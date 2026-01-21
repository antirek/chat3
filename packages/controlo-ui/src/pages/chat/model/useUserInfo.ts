import { ref } from 'vue';
import { getTenantApiUrl } from '@/shared/lib/utils/url';
import { useCredentialsStore } from '@/app/stores/credentials';

export function useUserInfo() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const userData = ref<any | null>(null);

  async function loadUserInfo(userId: string): Promise<any | null> {
    loading.value = true;
    error.value = null;
    userData.value = null;

    try {
      const credentialsStore = useCredentialsStore();
      const url = getTenantApiUrl(`/api/users/${userId}`);
      
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      userData.value = data.data;
      return data.data;
    } catch (err: any) {
      error.value = err.message || 'Ошибка загрузки данных пользователя';
      console.error('Error loading user info:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    userData.value = null;
    error.value = null;
  }

  return {
    loading,
    error,
    userData,
    loadUserInfo,
    clear,
  };
}
