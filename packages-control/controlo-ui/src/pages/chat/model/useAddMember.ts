import { ref, type Ref } from 'vue';
import { useCredentialsStore } from '@/app/stores/credentials';
import { getTenantApiUrl } from '@/shared/lib/utils/url';
import { useModal } from '@/shared/lib/composables/useModal';

export function useAddMember(
  selectedDialogId: Ref<string | null>,
  loadMembers: () => Promise<void>
) {
  const credentialsStore = useCredentialsStore();
  const addMemberModal = useModal();
  
  const availableUsers = ref<any[]>([]);
  const loadingUsers = ref(false);
  const usersError = ref<string | null>(null);
  const selectedUser = ref('');
  const memberType = ref('');
  const metaTags = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }]);
  const adding = ref(false);

  async function open() {
    if (!selectedDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    addMemberModal.open();
    selectedUser.value = '';
    memberType.value = '';
    metaTags.value = [{ key: '', value: '' }];
    availableUsers.value = [];
    usersError.value = null;
    
    // Загружаем список пользователей
    await loadUsers();
  }

  function close() {
    addMemberModal.close();
    selectedUser.value = '';
    memberType.value = '';
    metaTags.value = [{ key: '', value: '' }];
    availableUsers.value = [];
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
      availableUsers.value = data.data || [];
    } catch (error: any) {
      console.error('Error loading users:', error);
      usersError.value = error.message || 'Ошибка загрузки пользователей';
      availableUsers.value = [];
    } finally {
      loadingUsers.value = false;
    }
  }

  function addMetaRow() {
    metaTags.value.push({ key: '', value: '' });
  }

  function removeMetaRow(index: number) {
    if (metaTags.value.length > 1) {
      metaTags.value.splice(index, 1);
    } else {
      metaTags.value[0] = { key: '', value: '' };
    }
  }

  function collectMetaTags(): Record<string, string> {
    const meta: Record<string, string> = {};
    metaTags.value.forEach((tag) => {
      if (tag.key.trim() && tag.value.trim()) {
        meta[tag.key.trim()] = tag.value.trim();
      }
    });
    return meta;
  }

  async function submit() {
    if (!selectedDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    const userId = selectedUser.value?.trim();
    if (!userId || userId.length === 0) {
      alert('Пожалуйста, выберите пользователя');
      return;
    }
    
    if (!selectedDialogId.value) {
      alert('Ошибка: не выбран диалог');
      return;
    }
    
    adding.value = true;
    try {
      const url = getTenantApiUrl(`/api/dialogs/${selectedDialogId.value}/members/add`);
      const requestBody: any = { userId };
      if (memberType.value && memberType.value.trim()) {
        requestBody.type = memberType.value.trim();
      }
      
      console.log('Adding member:', { 
        dialogId: selectedDialogId.value, 
        userId,
        requestBody,
        headers: credentialsStore.getHeaders()
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentialsStore.getHeaders(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            // Если есть детали валидации, добавляем их
            if (errorData.details) {
              const details = Array.isArray(errorData.details) 
                ? errorData.details.map((d: any) => d.message || d).join(', ')
                : JSON.stringify(errorData.details);
              errorMessage += ` (${details})`;
            }
          } else {
            const errorText = await response.text();
            if (errorText && !errorText.startsWith('<!DOCTYPE')) {
              errorMessage = errorText;
            }
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Member added successfully:', result);
      
      // Устанавливаем мета-теги, если они есть
      const meta = collectMetaTags();
      if (Object.keys(meta).length > 0) {
        try {
          const entityId = `${selectedDialogId.value}:${selectedUser.value}`;
          for (const [key, value] of Object.entries(meta)) {
            const metaUrl = getTenantApiUrl(`/api/meta/dialogMember/${entityId}/${key}`);
            const metaResponse = await fetch(metaUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                ...credentialsStore.getHeaders(),
              },
              body: JSON.stringify({ value, dataType: 'string' }),
            });
            
            if (!metaResponse.ok) {
              console.warn(`Failed to set meta tag ${key}:`, await metaResponse.text());
            }
          }
        } catch (metaError) {
          console.error('Error setting meta tags:', metaError);
        }
      }
      
      alert('Участник успешно добавлен!');
      
      // Обновляем список участников
      await loadMembers();
      
      close();
    } catch (error: any) {
      console.error('Error adding member:', error);
      const errorMessage = error.message || 'Unknown error';
      alert(`Ошибка при добавлении участника: ${errorMessage}`);
      // Не закрываем модальное окно при ошибке, чтобы пользователь мог исправить данные
    } finally {
      adding.value = false;
    }
  }

  return {
    isOpen: addMemberModal.isOpen,
    availableUsers,
    loadingUsers,
    usersError,
    selectedUser,
    memberType,
    metaTags,
    adding,
    open,
    close,
    loadUsers,
    addMetaRow,
    removeMetaRow,
    submit,
  };
}
