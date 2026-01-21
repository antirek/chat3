import { ref } from 'vue';
import { useConfigStore } from '@/app/stores/config';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getTenantApiUrl } from '@/shared/lib/utils/url';

export function useUsers() {
  const configStore = useConfigStore();
  const credentialsStore = useCredentialsStore();

  const loadingUsers = ref(false);
  const usersError = ref<string | null>(null);
  const users = ref<any[]>([]);

  async function loadUsers() {
    try {
      loadingUsers.value = true;
      usersError.value = null;

      const url = getTenantApiUrl('/api/users?limit=100');
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      users.value = (data.data || []).map((user: any) => ({
        ...user,
        displayName: user.displayName || user.userId,
      }));
    } catch (error: any) {
      console.error('Error loading users:', error);
      usersError.value = error.message || 'Ошибка загрузки пользователей';
      users.value = [];
    } finally {
      loadingUsers.value = false;
    }
  }

  return {
    loadingUsers,
    usersError,
    users,
    loadUsers,
  };
}
