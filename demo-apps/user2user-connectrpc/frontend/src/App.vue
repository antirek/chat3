<template>
  <div class="app">
    <div class="app-header">
      <h1>User2User Chat Demo (ConnectRPC)</h1>
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
          :ws-connected="streamConnected1"
          :dialog-id="dialogId"
          @send="handleSendMessage1"
        />
        <ChatPanel
          :userId="user2"
          :title="`User 2 (${user2})`"
          :messages="messages2"
          :ws-connected="streamConnected2"
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ApiKeyInput from './components/ApiKeyInput.vue';
import UserSelector from './components/UserSelector.vue';
import DialogSelector from './components/DialogSelector.vue';
import ChatPanel from './components/ChatPanel.vue';
import { useConnectApi } from './composables/useConnectApi.js';
import type { Message, Update } from './types/index.js';

const { apiKey, setApiKey, getMessages, sendMessage, getUserDialogs, subscribeUpdates } = useConnectApi();

const user1 = ref<string>('');
const user2 = ref<string>('');
const dialogId = ref<string | null>(null);

const messages1 = ref<Message[]>([]);
const messages2 = ref<Message[]>([]);

// Отслеживаем обработанные обновления, чтобы избежать дублирующих перезагрузок
const processedUpdates1 = ref<Set<string>>(new Set());
const processedUpdates2 = ref<Set<string>>(new Set());

// Подписки на обновления через ConnectRPC streaming
const streamConnected1 = ref(false);
const streamConnected2 = ref(false);
let streamAbortController1: AbortController | null = null;
let streamAbortController2: AbortController | null = null;

const handleApiKeyUpdate = (key: string) => {
  setApiKey(key);
};

const handleUser1Update = async (userId: string) => {
  user1.value = userId;
  dialogId.value = null;
  messages1.value = [];
  messages2.value = [];
  stopStreaming1();
};

const handleUser2Update = async (userId: string) => {
  user2.value = userId;
  dialogId.value = null;
  messages1.value = [];
  messages2.value = [];
  stopStreaming2();
};

const handleDialogIdUpdate = async (newDialogId: string) => {
  dialogId.value = newDialogId;
  if (newDialogId) {
    await loadMessages();
    startStreaming1();
    startStreaming2();
  } else {
    messages1.value = [];
    messages2.value = [];
    stopStreaming1();
    stopStreaming2();
  }
};

const loadMessages = async () => {
  if (!dialogId.value || !user1.value || !apiKey.value) {
    return;
  }

  try {
    // Очищаем обработанные обновления при загрузке сообщений
    processedUpdates1.value.clear();
    processedUpdates2.value.clear();
    
    const response1 = await getMessages(dialogId.value, user1.value);
    // Сортируем сообщения по дате создания (старые первыми, новые внизу)
    messages1.value = (response1.messages || []).sort((a: Message, b: Message) => 
      (a.created_at || 0) - (b.created_at || 0)
    );

    if (user2.value) {
      const response2 = await getMessages(dialogId.value, user2.value);
      // Сортируем сообщения по дате создания (старые первыми, новые внизу)
      messages2.value = (response2.messages || []).sort((a: Message, b: Message) => 
        (a.created_at || 0) - (b.created_at || 0)
      );
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
      // Не добавляем сообщение сразу, оно придет через ConnectRPC streaming
      // Это предотвращает дублирование сообщений
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
      // Не добавляем сообщение сразу, оно придет через ConnectRPC streaming
      // Это предотвращает дублирование сообщений
      console.log('[App] Message sent:', response.message.message_id);
    }
  } catch (error: any) {
    console.error('[App] Error sending message:', error);
    alert(`Failed to send message: ${error.message || 'Unknown error'}`);
  }
};

// Обработка обновлений через ConnectRPC streaming для user1
const handleUpdate1 = async (update: Update) => {
  if (!dialogId.value) return;
  
  if (update.event_type === 'message.create') {
    const updateKey = `${update.entity_id}_${update.created_at}`;
    
    // Пропускаем уже обработанные обновления
    if (processedUpdates1.value.has(updateKey)) {
      return;
    }
    processedUpdates1.value.add(updateKey);
    
    // Если есть полные данные сообщения в data.message
    if (update.data?.message) {
      const message = update.data.message as Message;
      if (message.dialog_id === dialogId.value) {
        // Проверяем, что сообщение еще не добавлено
        if (!messages1.value.some(m => m.message_id === message.message_id)) {
          console.log('[App] Adding message to user1 chat via ConnectRPC streaming:', message.message_id);
          messages1.value.push(message);
          // Сортируем по дате создания после добавления (старые первыми, новые внизу)
          messages1.value.sort((a: Message, b: Message) => 
            (a.created_at || 0) - (b.created_at || 0)
          );
        }
      }
    } else if (update.entity_id && update.entity_id.startsWith('msg_')) {
      // Если нет полных данных, но есть entity_id (ID сообщения), перезагружаем сообщения из диалога
      // Но только если сообщения еще нет в списке
      const messageId = update.entity_id;
      if (!messages1.value.some(m => m.message_id === messageId)) {
        console.log('[App] ConnectRPC streaming update for user1: message.create with entity_id:', messageId, 'Reloading messages...');
        try {
          const response = await getMessages(dialogId.value, user1.value);
          // Обновляем список сообщений, сортируя по дате создания (старые первыми, новые внизу)
          messages1.value = (response.messages || []).sort((a: Message, b: Message) => 
            (a.created_at || 0) - (b.created_at || 0)
          );
        } catch (error) {
          console.error('[App] Error reloading messages for user1:', error);
        }
      }
    }
  }
};

// Обработка обновлений через ConnectRPC streaming для user2
const handleUpdate2 = async (update: Update) => {
  if (!dialogId.value) return;
  
  if (update.event_type === 'message.create') {
    const updateKey = `${update.entity_id}_${update.created_at}`;
    
    // Пропускаем уже обработанные обновления
    if (processedUpdates2.value.has(updateKey)) {
      return;
    }
    processedUpdates2.value.add(updateKey);
    
    // Если есть полные данные сообщения в data.message
    if (update.data?.message) {
      const message = update.data.message as Message;
      if (message.dialog_id === dialogId.value) {
        // Проверяем, что сообщение еще не добавлено
        if (!messages2.value.some(m => m.message_id === message.message_id)) {
          console.log('[App] Adding message to user2 chat via ConnectRPC streaming:', message.message_id);
          messages2.value.push(message);
          // Сортируем по дате создания после добавления (старые первыми, новые внизу)
          messages2.value.sort((a: Message, b: Message) => 
            (a.created_at || 0) - (b.created_at || 0)
          );
        }
      }
    } else if (update.entity_id && update.entity_id.startsWith('msg_')) {
      // Если нет полных данных, но есть entity_id (ID сообщения), перезагружаем сообщения из диалога
      // Но только если сообщения еще нет в списке
      const messageId = update.entity_id;
      if (!messages2.value.some(m => m.message_id === messageId)) {
        console.log('[App] ConnectRPC streaming update for user2: message.create with entity_id:', messageId, 'Reloading messages...');
        try {
          const response = await getMessages(dialogId.value, user2.value);
          // Обновляем список сообщений, сортируя по дате создания (старые первыми, новые внизу)
          messages2.value = (response.messages || []).sort((a: Message, b: Message) => 
            (a.created_at || 0) - (b.created_at || 0)
          );
        } catch (error) {
          console.error('[App] Error reloading messages for user2:', error);
        }
      }
    }
  }
};

// Запуск ConnectRPC streaming для user1
const startStreaming1 = async () => {
  if (!apiKey.value || !user1.value || !dialogId.value) {
    return;
  }

  stopStreaming1();

  try {
    streamAbortController1 = new AbortController();
    streamConnected1.value = true;

    // Запускаем async iterable для streaming
    (async () => {
      try {
        for await (const update of subscribeUpdates(user1.value)) {
          // Обрабатываем каждое обновление
          await handleUpdate1(update);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('[App] ConnectRPC streaming error for user1:', error);
          streamConnected1.value = false;
        }
      }
    })();
  } catch (error) {
    console.error('[App] Error starting ConnectRPC streaming for user1:', error);
    streamConnected1.value = false;
  }
};

// Остановка ConnectRPC streaming для user1
const stopStreaming1 = () => {
  if (streamAbortController1) {
    streamAbortController1.abort();
    streamAbortController1 = null;
  }
  streamConnected1.value = false;
};

// Запуск ConnectRPC streaming для user2
const startStreaming2 = async () => {
  if (!apiKey.value || !user2.value || !dialogId.value) {
    return;
  }

  stopStreaming2();

  try {
    streamAbortController2 = new AbortController();
    streamConnected2.value = true;

    // Запускаем async iterable для streaming
    (async () => {
      try {
        for await (const update of subscribeUpdates(user2.value)) {
          // Обрабатываем каждое обновление
          await handleUpdate2(update);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('[App] ConnectRPC streaming error for user2:', error);
          streamConnected2.value = false;
        }
      }
    })();
  } catch (error) {
    console.error('[App] Error starting ConnectRPC streaming for user2:', error);
    streamConnected2.value = false;
  }
};

// Остановка ConnectRPC streaming для user2
const stopStreaming2 = () => {
  if (streamAbortController2) {
    streamAbortController2.abort();
    streamAbortController2 = null;
  }
  streamConnected2.value = false;
};

// Переподключение streaming при изменении apiKey
watch(() => apiKey.value, (newKey) => {
  if (newKey && user1.value && dialogId.value) {
    stopStreaming1();
    setTimeout(() => {
      if (user1.value && dialogId.value) {
        startStreaming1();
      }
    }, 100);
  }
  if (newKey && user2.value && dialogId.value) {
    stopStreaming2();
    setTimeout(() => {
      if (user2.value && dialogId.value) {
        startStreaming2();
      }
    }, 100);
  }
});

// Переподключение streaming при изменении пользователей
watch(() => user1.value, (newUser1) => {
  if (apiKey.value && newUser1 && dialogId.value) {
    stopStreaming1();
    setTimeout(() => {
      if (user1.value && dialogId.value) {
        startStreaming1();
      }
    }, 100);
  }
});

watch(() => user2.value, (newUser2) => {
  if (apiKey.value && newUser2 && dialogId.value) {
    stopStreaming2();
    setTimeout(() => {
      if (user2.value && dialogId.value) {
        startStreaming2();
      }
    }, 100);
  }
});

onMounted(() => {
  if (apiKey.value && user1.value && dialogId.value) {
    startStreaming1();
  }
  if (apiKey.value && user2.value && dialogId.value) {
    startStreaming2();
  }
});

onUnmounted(() => {
  stopStreaming1();
  stopStreaming2();
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
  flex: 1 1 auto;
  min-height: 0; /* Важно для flex-контейнера с overflow */
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
  flex: 1 1 auto;
  min-height: 0; /* Важно для flex-контейнера с overflow */
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
