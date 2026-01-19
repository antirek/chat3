/**
 * Модуль модального окна для просмотра данных
 * Отвечает за: отображение JSON данных в модальном окне
 */
import { ref } from 'vue';
import { useModal } from '@/shared/lib/composables/useModal';

export function useDataModal() {
  const dataModal = useModal();
  const dataModalContent = ref('');

  function showDataModal(data: any) {
    try {
      const formattedJson = JSON.stringify(data, null, 2);
      dataModalContent.value = formattedJson;
      dataModal.open();
    } catch (error: any) {
      dataModalContent.value = 'Ошибка при отображении данных: ' + error.message;
      dataModal.open();
    }
  }

  function closeDataModal() {
    dataModal.close();
  }

  return {
    dataModal,
    dataModalContent,
    showDataModal,
    closeDataModal,
  };
}
