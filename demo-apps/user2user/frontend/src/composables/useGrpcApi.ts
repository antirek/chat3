import { ref } from 'vue';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useGrpcApi() {
  const apiKey = ref<string>(localStorage.getItem('user2user_api_key') || '');
  const tenantId = ref<string>('tnt_default');

  const setApiKey = (key: string) => {
    apiKey.value = key;
    localStorage.setItem('user2user_api_key', key);
  };

  const getConfig = async () => {
    const response = await fetch(`${API_BASE_URL}/api/config`);
    return response.json();
  };

  const findOrCreateDialog = async (user1: string, user2: string) => {
    const response = await fetch(`${API_BASE_URL}/api/dialogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey.value,
        tenantId: tenantId.value,
        user1,
        user2,
      }),
    });
    return response.json();
  };

  const getDialog = async (dialogId: string, userId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/api/dialogs/${dialogId}?apiKey=${encodeURIComponent(apiKey.value)}&tenantId=${encodeURIComponent(tenantId.value)}&userId=${encodeURIComponent(userId)}`
    );
    return response.json();
  };

  const getMessages = async (dialogId: string, userId: string, page = 1, limit = 50) => {
    const response = await fetch(
      `${API_BASE_URL}/api/dialogs/${dialogId}/messages?apiKey=${encodeURIComponent(apiKey.value)}&tenantId=${encodeURIComponent(tenantId.value)}&userId=${encodeURIComponent(userId)}&page=${page}&limit=${limit}`
    );
    return response.json();
  };

  const sendMessage = async (dialogId: string, senderId: string, content: string, type = 'internal.text') => {
    const response = await fetch(`${API_BASE_URL}/api/dialogs/${dialogId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey.value,
        tenantId: tenantId.value,
        senderId,
        content,
        type,
      }),
    });
    return response.json();
  };

  const getUserDialogs = async (userId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/api/dialogs?apiKey=${encodeURIComponent(apiKey.value)}&tenantId=${encodeURIComponent(tenantId.value)}&userId=${encodeURIComponent(userId)}`
    );
    return response.json();
  };

  return {
    apiKey,
    tenantId,
    setApiKey,
    getConfig,
    findOrCreateDialog,
    getDialog,
    getMessages,
    sendMessage,
    getUserDialogs,
  };
}
