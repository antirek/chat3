/**
 * Composable для работы с ConnectRPC API
 * Прямые вызовы из браузера без Express прокси
 */
import { ref, onUnmounted } from 'vue';
import { Chat3ConnectClient } from '@chat3/user-connectrpc-client-ts';
import type { Update } from '../types/index.js';

const CONNECTRPC_SERVER_URL = import.meta.env.VITE_CONNECTRPC_SERVER_URL || 'http://localhost:8080';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';

export function useConnectApi() {
  const apiKey = ref<string>(localStorage.getItem('user2user_connectrpc_api_key') || '');
  const tenantId = ref<string>('tnt_default');
  const connectrpcServerUrl = ref<string>(CONNECTRPC_SERVER_URL);

  const setApiKey = (key: string) => {
    apiKey.value = key;
    localStorage.setItem('user2user_connectrpc_api_key', key);
  };

  // Получить конфигурацию с сервера
  const getConfig = async () => {
    const response = await fetch(`${API_BASE_URL}/api/config`);
    const config = await response.json();
    if (config.connectrpcServerUrl) {
      connectrpcServerUrl.value = config.connectrpcServerUrl;
    }
    return config;
  };

  // Создать ConnectRPC клиент
  const createClient = (userId: string) => {
    return new Chat3ConnectClient({
      baseUrl: connectrpcServerUrl.value,
      apiKey: apiKey.value,
      tenantId: tenantId.value,
      userId: userId
    });
  };

  // Найти или создать диалог (через Express API для создания диалога)
  const findOrCreateDialog = async (user1: string, user2: string) => {
    // Для создания диалога используем Express API, так как ConnectRPC не имеет метода создания диалогов
    // В реальном приложении можно добавить метод CreateDialog в ConnectRPC
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

  // Получить диалог
  const getDialog = async (dialogId: string, userId: string) => {
    const client = createClient(userId);
    const response = await client.getUserDialogs({ limit: 100 });
    const dialog = response.dialogs?.find((d: any) => d.dialog_id === dialogId || d.dialogId === dialogId);
    return { dialog };
  };

  // Получить сообщения диалога
  const getMessages = async (dialogId: string, userId: string, page = 1, limit = 50) => {
    const client = createClient(userId);
    const response = await client.getDialogMessages(dialogId, { page, limit });
    
    // Преобразуем формат из ConnectRPC в нужный формат
    const messages = (response.messages || []).map((msg: any) => ({
      message_id: msg.messageId || msg.message_id,
      dialog_id: msg.dialogId || msg.dialog_id,
      sender_id: msg.senderId || msg.sender_id,
      type: msg.type,
      content: msg.content,
      meta: msg.meta,
      statuses: msg.statuses,
      reaction_set: msg.reactionSet || msg.reaction_set,
      sender_info: msg.senderInfo || msg.sender_info,
      created_at: msg.createdAt || msg.created_at,
      topic_id: msg.topicId || msg.topic_id,
      topic: msg.topic
    }));

    return {
      messages,
      pagination: response.pagination
    };
  };

  // Отправить сообщение
  const sendMessage = async (dialogId: string, senderId: string, content: string, type = 'internal.text') => {
    const client = createClient(senderId);
    const response = await client.sendMessage(dialogId, senderId, { content, type });
    
    // Преобразуем формат из ConnectRPC в нужный формат
    const message = response.message;
    return {
      message: {
        message_id: message.messageId || message.message_id,
        dialog_id: message.dialogId || message.dialog_id,
        sender_id: message.senderId || message.sender_id,
        type: message.type,
        content: message.content,
        meta: message.meta,
        statuses: message.statuses,
        reaction_set: message.reactionSet || message.reaction_set,
        sender_info: message.senderInfo || message.sender_info,
        created_at: message.createdAt || message.created_at,
        topic_id: message.topicId || message.topic_id,
        topic: message.topic
      }
    };
  };

  // Получить диалоги пользователя
  const getUserDialogs = async (userId: string) => {
    const client = createClient(userId);
    const response = await client.getUserDialogs({ limit: 100 });
    
    // Преобразуем формат из ConnectRPC в нужный формат
    const dialogs = (response.dialogs || []).map((dialog: any) => ({
      dialog_id: dialog.dialogId || dialog.dialog_id,
      tenant_id: dialog.tenantId || dialog.tenant_id,
      name: dialog.name,
      created_by: dialog.createdBy || dialog.created_by,
      created_at: dialog.createdAt || dialog.created_at,
      updated_at: dialog.updatedAt || dialog.updated_at,
      meta: dialog.meta,
      member: dialog.member,
      last_message: dialog.lastMessage || dialog.last_message
    }));

    return { dialogs };
  };

  // Подписка на обновления через ConnectRPC streaming
  // Возвращает async generator для streaming
  const subscribeUpdates = async function* (userId: string): AsyncGenerator<Update, void, unknown> {
    const client = createClient(userId);
    
    try {
      // Используем async generator для streaming
      for await (const update of client.subscribeUpdates()) {
        // Преобразуем формат из ConnectRPC в нужный формат
        const formattedUpdate: Update = {
          update_id: update.updateId || update.update_id,
          tenant_id: update.tenantId || update.tenant_id,
          user_id: update.userId || update.user_id,
          entity_id: update.entityId || update.entity_id,
          event_type: update.eventType || update.event_type,
          data: update.data,
          created_at: update.createdAt || update.created_at
        };
        yield formattedUpdate;
      }
    } catch (error) {
      console.error('[ConnectRPC] Streaming error:', error);
      throw error;
    }
  };

  return {
    apiKey,
    tenantId,
    connectrpcServerUrl,
    setApiKey,
    getConfig,
    findOrCreateDialog,
    getDialog,
    getMessages,
    sendMessage,
    getUserDialogs,
    subscribeUpdates,
  };
}
