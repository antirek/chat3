import { ref, type Ref } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getTenantApiUrl } from '@/shared/lib/utils/url';

export function useCreateDialog(
  selectedUserId: Ref<string | null>,
  loadDialogs: () => Promise<void>
) {
  const credentialsStore = useCredentialsStore();
  
  const isOpen = ref(false);
  const users = ref<any[]>([]);
  const loadingUsers = ref(false);
  const usersError = ref<string | null>(null);
  const usersLoaded = ref(false);
  const selectedMembers = ref<string[]>([]);
  const creating = ref(false);

  function open() {
    isOpen.value = true;
    users.value = [];
    selectedMembers.value = [];
    usersLoaded.value = false;
    usersError.value = null;
    
    // Автоматически добавляем выбранного пользователя в участники
    if (selectedUserId.value) {
      selectedMembers.value = [selectedUserId.value];
    }
  }

  function close() {
    isOpen.value = false;
    users.value = [];
    selectedMembers.value = [];
    usersLoaded.value = false;
    usersError.value = null;
  }

  async function loadUsers() {
    loadingUsers.value = true;
    usersError.value = null;

    try {
      const url = getTenantApiUrl('/api/users?limit=100');
      const response = await fetch(url, {
        headers: credentialsStore.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      users.value = (data.data || []).map((user: any) => ({
        userId: user.userId,
        userName: user.name || user.userId,
        userType: user.type || 'user',
      }));
      usersLoaded.value = true;
    } catch (error: any) {
      console.error('Error loading users:', error);
      usersError.value = error.message || 'Ошибка загрузки пользователей';
      users.value = [];
    } finally {
      loadingUsers.value = false;
    }
  }

  async function create(): Promise<string | null> {
    if (selectedMembers.value.length === 0) {
      alert('Выберите хотя бы одного участника');
      return null;
    }

    creating.value = true;
    try {
      const url = getTenantApiUrl('/api/dialogs');
      const requestBody = {
        members: selectedMembers.value.map((userId) => ({ userId })),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...credentialsStore.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dialog = result.data || result;
      const dialogId = dialog.dialogId || dialog._id;

      // Обновляем список диалогов
      await loadDialogs();

      close();
      return dialogId;
    } catch (error: any) {
      console.error('Error creating dialog:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при создании диалога: ${errorMessage}`);
      return null;
    } finally {
      creating.value = false;
    }
  }

  return {
    isOpen,
    users,
    loadingUsers,
    usersError,
    usersLoaded,
    selectedMembers,
    creating,
    open,
    close,
    loadUsers,
    create,
  };
}
