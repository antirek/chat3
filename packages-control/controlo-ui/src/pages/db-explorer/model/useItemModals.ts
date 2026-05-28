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
  getItemId: (item: any, index: number) => string;
}

export function useItemModals(deps: UseItemModalsDependencies) {
  const { currentModel, loadModelData, getItemId } = deps;

  // State для модального окна записи
  const itemModal = useModal();
  const itemModalMode = ref<'view' | 'edit' | 'create'>('view');
  const itemModalTitle = ref('');
  const itemModalContent = ref('');
  const itemModalJsonData = ref('');
  const itemModalItemId = ref<string | null>(null);

  async function viewItem(item: any, _index: number) {
    try {
      // Делаем глубокую копию объекта, чтобы избежать проблем с реактивностью Vue
      const itemCopy = JSON.parse(JSON.stringify(item));
      
      itemModalTitle.value = `Просмотр: ${currentModel.value}`;
      itemModalContent.value = JSON.stringify(itemCopy, null, 2);
      itemModalMode.value = 'view';
      itemModal.open();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  }

  async function editItem(item: any, index: number) {
    try {
      // Делаем глубокую копию объекта, чтобы избежать проблем с реактивностью Vue
      const itemCopy = JSON.parse(JSON.stringify(item));
      const itemId = getItemId(item, index);
      
      itemModalTitle.value = `Редактирование: ${currentModel.value}`;
      itemModalJsonData.value = JSON.stringify(itemCopy, null, 2);
      itemModalMode.value = 'edit';
      itemModalItemId.value = itemId;
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
