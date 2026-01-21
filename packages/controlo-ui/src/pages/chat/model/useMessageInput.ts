import { ref } from 'vue';

export function useMessageInput() {
  const messageText = ref('');
  const sending = ref(false);
  const sendError = ref<string | null>(null);

  function clearInput() {
    messageText.value = '';
    sendError.value = null;
  }

  function setError(error: string) {
    sendError.value = error;
  }

  function validate(): boolean {
    if (!messageText.value.trim()) {
      setError('Сообщение не может быть пустым');
      return false;
    }
    return true;
  }

  return {
    messageText,
    sending,
    sendError,
    clearInput,
    setError,
    validate,
  };
}
