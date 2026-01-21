/**
 * Модуль модальных окон для работы с записями (CRUD)
 * Отвечает за: просмотр, создание, редактирование и удаление записей
 */
import { ref, Ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';
import { getControlApiUrl } from './useUtils';

interface UseItemModalsDependencies {
  currentModel: Ref<string | null>;
  loadModelData: () => Promise<void>;
}

export function useItemModals(deps: UseItemModalsDependencies) {
  const { currentModel, loadModelData } = deps;

  // State для модального окна записи
  const itemModal = useModal();
  const itemModalMode = ref<'view' | 'edit' | 'create'>('view');
  const itemModalTitle = ref('');
  const itemModalContent = ref('');
  const itemModalJsonData = ref('');
  const itemModalItemId = ref<string | null>(null);

  async function viewItem(id: string) {
    try {
      const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${id}`));
      if (!response.ok) throw new Error('Failed to load item');
      const result = await response.json();
      
      itemModalTitle.value = `Просмотр: ${currentModel.value}`;
      itemModalContent.value = JSON.stringify(result.data, null, 2);
      itemModalMode.value = 'view';
      itemModal.open();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  async function editItem(id: string) {
    try {
      const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${id}`));
      if (!response.ok) throw new Error('Failed to load item');
      const result = await response.json();
      
      itemModalTitle.value = `Редактирование: ${currentModel.value}`;
      itemModalJsonData.value = JSON.stringify(result.data, null, 2);
      itemModalMode.value = 'edit';
      itemModalItemId.value = id;
      itemModal.open();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Вы уверены, что хотите удалить эту запись?')) return;

    try {
      const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${id}`), {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete');
      loadModelData();
      alert('Запись удалена');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  function showCreateModal() {
    itemModalTitle.value = `Создать запись: ${currentModel.value}`;
    itemModalJsonData.value = '{}';
    itemModalMode.value = 'create';
    itemModalItemId.value = null;
    itemModal.open();
  }

  async function handleItemSubmit() {
    try {
      const jsonData = JSON.parse(itemModalJsonData.value);
      
      if (itemModalMode.value === 'create') {
        const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData)
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create');
        }
        alert('Запись создана');
      } else {
        const response = await fetch(getControlApiUrl(`/api/db-explorer/models/${currentModel.value}/${itemModalItemId.value}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData)
        });
        if (!response.ok) throw new Error('Failed to update');
        alert('Запись обновлена');
      }
      
      itemModal.close();
      loadModelData();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  function closeItemModal() {
    itemModal.close();
    itemModalTitle.value = '';
    itemModalContent.value = '';
    itemModalJsonData.value = '';
    itemModalItemId.value = null;
  }

  return {
    itemModal,
    itemModalMode,
    itemModalTitle,
    itemModalContent,
    itemModalJsonData,
    itemModalItemId,
    viewItem,
    editItem,
    deleteItem,
    showCreateModal,
    handleItemSubmit,
    closeItemModal,
  };
}
