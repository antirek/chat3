<template>
  <div class="app">
    <div class="app-header">
      <h1>User2User Chat Demo</h1>
      <ApiKeyInput :api-key="apiKey" @update:api-key="handleApiKeyUpdate" />
    </div>

    <div v-if="apiKey" class="app-content">
      <UserSelector
        :user1="user1"
        :user2="user2"
        @update:user1="handleUser1Update"
        @update:user2="handleUser2Update"
      />

      <DialogSelector
        v-if="user1 && user2"
        :user1="user1"
        :user2="user2"
        @update:dialogId="handleDialogIdUpdate"
      />

      <div v-if="user1 && user2 && dialogId" class="chat-container">
        <ChatPanel
          :userId="user1"
          :title="`User 1 (${user1})`"
          :messages="messages1"
          :ws-connected="wsConnected1"
          :dialog-id="dialogId"
          @send="handleSendMessage1"
        />
        <ChatPanel
          :userId="user2"
          :title="`User 2 (${user2})`"
          :messages="messages2"
          :ws-connected="wsConnected2"
          :dialog-id="dialogId"
          @send="handleSendMessage2"
        />
      </div>
    </div>

    <div v-else class="app-placeholder">
      <p>Please enter API Key to start</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import ApiKeyInput from './components/ApiKeyInput.vue';
import UserSelector from './components/UserSelector.vue';
import DialogSelector from './components/DialogSelector.vue';
import ChatPanel from './components/ChatPanel.vue';
import { useGrpcApi } from './composables/useGrpcApi.js';
import { useWebSocket } from './composables/useWebSocket.js';
import type { Message, Update } from './types/index.js';

const { apiKey, setApiKey, getMessages, sendMessage, getDialog } = useGrpcApi();

const user1 = ref<string>('');
const user2 = ref<string>('');
const dialogId = ref<string | null>(null);

const messages1 = ref<Message[]>([]);
const messages2 = ref<Message[]>([]);

const tenantId = ref('tnt_default');

const ws1 = useWebSocket(apiKey, tenantId, user1);
const ws2 = useWebSocket(apiKey, tenantId, user2);

const wsConnected1 = ws1.connected;
const wsConnected2 = ws2.connected;

const handleApiKeyUpdate = (key: string) => {
  setApiKey(key);
};

const handleUser1Update = async (userId: string) => {
  user1.value = userId;
  dialogId.value = null;
  messages1.value = [];
  messages2.value = [];
};

const handleUser2Update = async (userId: string) => {
  user2.value = userId;
  dialogId.value = null;
  messages1.value = [];
  messages2.value = [];
};

const handleDialogIdUpdate = async (newDialogId: string) => {
  dialogId.value = newDialogId;
  if (newDialogId) {
    await loadMessages();
  } else {
    messages1.value = [];
    messages2.value = [];
  }
};

const loadMessages = async () => {
  if (!dialogId.value || !user1.value || !apiKey.value) {
    return;
  }

  try {
    const response1 = await getMessages(dialogId.value, user1.value);
    messages1.value = response1.messages || [];

    if (user2.value) {
      const response2 = await getMessages(dialogId.value, user2.value);
      messages2.value = response2.messages || [];
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
};

const handleSendMessage1 = async (content: string) => {
  if (!dialogId.value || !user1.value) {
    alert('Please select a dialog first');
    return;
  }

  try {
    const response = await sendMessage(dialogId.value, user1.value, content);
    if (response.message) {
      messages1.value.push(response.message);
      // Сообщение придет через WebSocket для обоих пользователей
      console.log('[App] Message sent:', response.message.message_id);
    }
  } catch (error: any) {
    console.error('[App] Error sending message:', error);
    alert(`Failed to send message: ${error.message || 'Unknown error'}`);
  }
};

const handleSendMessage2 = async (content: string) => {
  if (!dialogId.value || !user2.value) {
    alert('Please select a dialog first');
    return;
  }

  try {
    const response = await sendMessage(dialogId.value, user2.value, content);
    if (response.message) {
      messages2.value.push(response.message);
      // Сообщение придет через WebSocket для обоих пользователей
      console.log('[App] Message sent:', response.message.message_id);
    }
  } catch (error: any) {
    console.error('[App] Error sending message:', error);
    alert(`Failed to send message: ${error.message || 'Unknown error'}`);
  }
};

// Обработка обновлений через WebSocket
// Для user1: добавляем все новые сообщения из обновлений
watch(() => ws1.updates.value, async (updates) => {
  if (!updates.length || !dialogId.value) return;
  
  // Обрабатываем все обновления типа message.create
  for (const update of updates) {
    if (update.event_type === 'message.create') {
      // Если есть полные данные сообщения в data.message
      if (update.data?.message) {
        const message = update.data.message as Message;
        if (message.dialog_id === dialogId.value) {
          // Проверяем, что сообщение еще не добавлено
          if (!messages1.value.some(m => m.message_id === message.message_id)) {
            console.log('[App] Adding message to user1 chat via WebSocket:', message.message_id);
            messages1.value.push(message);
          }
        }
      } else if (update.entity_id && update.entity_id.startsWith('msg_')) {
        // Если нет полных данных, но есть entity_id (ID сообщения), перезагружаем сообщения из диалога
        console.log('[App] WebSocket update for user1: message.create with entity_id:', update.entity_id, 'Reloading messages...');
        try {
          const response = await getMessages(dialogId.value, user1.value);
          // Обновляем список сообщений, чтобы получить новое сообщение
          messages1.value = response.messages || [];
        } catch (error) {
          console.error('[App] Error reloading messages for user1:', error);
        }
      }
    }
  }
}, { deep: true });

// Для user2: добавляем все новые сообщения из обновлений
watch(() => ws2.updates.value, async (updates) => {
  if (!updates.length || !dialogId.value) return;
  
  // Обрабатываем все обновления типа message.create
  for (const update of updates) {
    if (update.event_type === 'message.create') {
      // Если есть полные данные сообщения в data.message
      if (update.data?.message) {
        const message = update.data.message as Message;
        if (message.dialog_id === dialogId.value) {
          // Проверяем, что сообщение еще не добавлено
          if (!messages2.value.some(m => m.message_id === message.message_id)) {
            console.log('[App] Adding message to user2 chat via WebSocket:', message.message_id);
            messages2.value.push(message);
          }
        }
      } else if (update.entity_id && update.entity_id.startsWith('msg_')) {
        // Если нет полных данных, но есть entity_id (ID сообщения), перезагружаем сообщения из диалога
        console.log('[App] WebSocket update for user2: message.create with entity_id:', update.entity_id, 'Reloading messages...');
        try {
          const response = await getMessages(dialogId.value, user2.value);
          // Обновляем список сообщений, чтобы получить новое сообщение
          messages2.value = response.messages || [];
        } catch (error) {
          console.error('[App] Error reloading messages for user2:', error);
        }
      }
    }
  }
}, { deep: true });

// Переподключение WebSocket при изменении apiKey
watch(() => apiKey.value, (newKey) => {
  if (newKey && user1.value) {
    ws1.disconnect();
    // Небольшая задержка перед переподключением
    setTimeout(() => {
      if (user1.value) {
        ws1.connect();
      }
    }, 100);
  }
  if (newKey && user2.value) {
    ws2.disconnect();
    setTimeout(() => {
      if (user2.value) {
        ws2.connect();
      }
    }, 100);
  }
});

// Переподключение WebSocket при изменении пользователей
watch(() => user1.value, (newUser1) => {
  if (apiKey.value && newUser1) {
    ws1.disconnect();
    setTimeout(() => {
      if (user1.value) {
        ws1.connect();
      }
    }, 100);
  }
});

watch(() => user2.value, (newUser2) => {
  if (apiKey.value && newUser2) {
    ws2.disconnect();
    setTimeout(() => {
      if (user2.value) {
        ws2.connect();
      }
    }, 100);
  }
});

onMounted(() => {
  if (apiKey.value && user1.value) {
    ws1.connect();
  }
  if (apiKey.value && user2.value) {
    ws2.connect();
  }
});

onUnmounted(() => {
  ws1.disconnect();
  ws2.disconnect();
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.app-header {
  background: white;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0 0 15px 0;
  font-size: 24px;
  font-weight: 600;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #666;
}

.chat-container {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
}

@media (max-width: 768px) {
  .chat-container {
    grid-template-columns: 1fr;
  }
}
</style>
