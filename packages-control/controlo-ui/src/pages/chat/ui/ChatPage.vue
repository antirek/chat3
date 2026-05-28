<template>
  <div class="chat-page" ref="chatPageRef">
    <div class="container">
      <!-- Левая колонка: выбор пользователя, диалога и опции -->
      <div class="left-column">
        <h1 class="page-title">Чат пользователя</h1>
        
        <div class="controls-panel">
          <!-- Секция: Пользователь -->
          <div class="control-section">
            <UserSelector
              :users="users"
              :selectedUserId="selectedUserId"
              :loading="loadingUsers"
              :error="usersError"
              @update:selectedUserId="selectedUserId = $event"
              @show-info="handleShowUserInfo"
            />
            
            <UserStats :stats="selectedUserStats" />
            
            <button
              class="add-dialog-button"
              :disabled="!selectedUserId"
              @click="handleOpenCreateDialog"
              title="Создать новый диалог"
            >
              ➕ Добавить диалог
            </button>
          </div>
          
          <!-- Разделитель -->
          <div class="section-divider"></div>
          
          <!-- Секция: Диалог -->
          <div class="control-section">
            <DialogSelector
              :dialogs="dialogs"
              :selectedDialogId="selectedDialogId"
              :loading="loadingDialogs"
              :error="dialogsError"
              :enabled="!!selectedUserId"
              @update:selectedDialogId="selectedDialogId = $event"
              @show-info="handleShowDialogInfo"
            />
            
            <DialogStats :stats="selectedDialogStats" />
          </div>
          
          <!-- Разделитель -->
          <div class="section-divider"></div>
          
          <!-- Секция: Опции -->
          <div class="control-section">
            <AutoRefreshSelector
              :interval="autoRefreshInterval"
              @update:interval="autoRefreshInterval = $event"
            />
          </div>
        </div>
      </div>

      <!-- Правая колонка: лента сообщений и поле ввода -->
      <div class="right-column">
        <div class="messages-container">
          <MessagesList
            :messages="messages"
            :loading="loadingMessages"
            :error="messagesError"
          />
        </div>

        <div class="input-container">
          <MessageInput
            v-model:message-text="messageText"
            :sending="sending"
            :error="sendError"
            :enabled="!!selectedDialogId && !!selectedUserId"
            @send="handleSendMessage"
            @keypress="handleKeyPress"
          />
        </div>
      </div>

      <!-- Третья колонка: список участников -->
      <div class="members-column">
        <DialogMembers
          :members="dialogMembers.members.value"
          :loading="dialogMembers.loading.value"
          :error="dialogMembers.error.value"
          :enabled="!!selectedDialogId"
          @add-member="handleOpenAddMember"
        />
      </div>
    </div>

    <!-- Модальное окно с информацией о пользователе -->
    <BaseModal
      :is-open="userInfoModal.isOpen.value"
      title="Информация о пользователе"
      max-width="800px"
      @close="handleCloseUserInfo"
    >
      <div v-if="loadingUserInfo" class="user-info-loading">
        Загрузка данных пользователя...
      </div>
      <div v-else-if="userInfoError" class="user-info-error">
        Ошибка: {{ userInfoError }}
      </div>
      <div v-else-if="userData" class="user-info-content">
        <div class="user-info-url">
          {{ getTenantApiUrl(`/api/users/${userData.userId || selectedUserId}`) }}
        </div>
        <pre class="user-info-json">{{ JSON.stringify(userData, null, 2) }}</pre>
      </div>
      <template #footer>
        <button
          v-if="userData"
          type="button"
          class="btn-copy"
          @click="copyUserJson"
        >
          📋 Копировать JSON
        </button>
        <button
          type="button"
          class="btn-close"
          @click="handleCloseUserInfo"
        >
          Закрыть
        </button>
      </template>
    </BaseModal>

    <!-- Модальное окно с информацией о диалоге -->
    <BaseModal
      :is-open="dialogInfoModal.isOpen.value"
      title="Информация о диалоге"
      max-width="800px"
      @close="handleCloseDialogInfo"
    >
      <div v-if="loadingDialogInfo" class="dialog-info-loading">
        Загрузка данных диалога...
      </div>
      <div v-else-if="dialogInfoError" class="dialog-info-error">
        Ошибка: {{ dialogInfoError }}
      </div>
      <div v-else-if="dialogData" class="dialog-info-content">
        <div class="dialog-info-url">
          {{ getTenantApiUrl(`/api/dialogs/${dialogData.dialogId || selectedDialogId}`) }}
        </div>
        <pre class="dialog-info-json">{{ JSON.stringify(dialogData, null, 2) }}</pre>
      </div>
      <template #footer>
        <button
          v-if="dialogData"
          type="button"
          class="btn-copy"
          @click="copyDialogJson"
        >
          📋 Копировать JSON
        </button>
        <button
          type="button"
          class="btn-close"
          @click="handleCloseDialogInfo"
        >
          Закрыть
        </button>
      </template>
    </BaseModal>

    <!-- Модальное окно создания диалога -->
    <CreateDialogModal
      :is-open="createDialog.isOpen.value"
      :users="createDialog.users.value"
      :loading-users="createDialog.loadingUsers.value"
      :users-error="createDialog.usersError.value"
      :users-loaded="createDialog.usersLoaded.value"
      :selected-members="createDialog.selectedMembers.value"
      :meta-tags="createDialog.createDialogMetaTags.value"
      :new-meta-key="createDialog.newMetaKeyForCreate.value"
      :new-meta-value="createDialog.newMetaValueForCreate.value"
      @close="createDialog.close"
      @load-users="createDialog.loadUsers"
      @create="handleCreateDialog"
      @add-meta-tag="createDialog.addCreateDialogMetaTag"
      @remove-meta-tag="createDialog.removeCreateDialogMetaTag"
      @update:selectedMembers="createDialog.selectedMembers.value = $event"
      @update:new-meta-key="createDialog.newMetaKeyForCreate.value = $event"
      @update:new-meta-value="createDialog.newMetaValueForCreate.value = $event"
    />

    <!-- Модальное окно добавления участника -->
    <AddMemberModal
      :is-open="addMember.isOpen.value"
      :available-users="addMember.availableUsers.value"
      :selected-user="addMember.selectedUser.value"
      :member-type="addMember.memberType.value"
      :meta-tags="addMember.metaTags.value"
      @close="addMember.close"
      @submit="addMember.submit"
      @update:selectedUser="addMember.selectedUser.value = $event"
      @update:memberType="addMember.memberType.value = $event"
      @add-meta-row="addMember.addMetaRow"
      @remove-meta-row="addMember.removeMetaRow"
      @update-meta-key="(i, v) => addMember.metaTags.value[i].key = v"
      @update-meta-value="(i, v) => addMember.metaTags.value[i].value = v"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, nextTick, watch, ref, computed } from 'vue';
import { useChat } from '../model/useChat';
import { useUserInfo } from '../model/useUserInfo';
import { useDialogInfo } from '../model/useDialogInfo';
import { useCreateDialog } from '../model/useCreateDialog';
import { useDialogMembers } from '../model/useDialogMembers';
import { useAddMember } from '../model/useAddMember';
import { useModal } from '@/shared/lib/composables/useModal';
import { getTenantApiUrl } from '@/shared/lib/utils/url';
import UserSelector from './UserSelector.vue';
import UserStats from './UserStats.vue';
import DialogSelector from './DialogSelector.vue';
import DialogStats from './DialogStats.vue';
import DialogMembers from './DialogMembers.vue';
import AutoRefreshSelector from './AutoRefreshSelector.vue';
import MessagesList from './MessagesList.vue';
import MessageInput from './MessageInput.vue';
import BaseModal from '@/shared/ui/BaseModal/BaseModal.vue';
import CreateDialogModal from '@/pages/dialogs-messages/ui/modals/CreateDialogModal.vue';
import AddMemberModal from '@/pages/user-dialogs/ui/modals/AddMemberModal.vue';

const chatPageRef = ref<HTMLElement | null>(null);

const {
  selectedUserId,
  selectedDialogId,
  autoRefreshInterval,
  loadingUsers,
  usersError,
  users,
  loadUsers,
  loadingDialogs,
  dialogsError,
  dialogs,
  loadDialogs,
  loadingMessages,
  messagesError,
  messages,
  messageText,
  sending,
  sendError,
  handleSendMessage,
  handleKeyPress,
} = useChat();

// Модальное окно для создания диалога
const createDialog = useCreateDialog(selectedUserId, loadDialogs);

// Участники диалога
const dialogMembers = useDialogMembers(selectedDialogId);

// Модальное окно для добавления участника
const addMember = useAddMember(selectedDialogId, dialogMembers.loadMembers);

async function handleOpenAddMember() {
  await addMember.open();
}

async function handleOpenCreateDialog() {
  if (!selectedUserId.value) {
    return;
  }
  createDialog.open();
}

async function handleCreateDialog() {
  const newDialogId = await createDialog.create();
  if (newDialogId && selectedUserId.value) {
    // Обновляем список диалогов и выбираем созданный диалог
    await loadDialogs();
    // Небольшая задержка, чтобы диалоги успели загрузиться
    await new Promise(resolve => setTimeout(resolve, 100));
    selectedDialogId.value = newDialogId;
  }
}

// Статистика выбранного пользователя
const selectedUserStats = computed(() => {
  if (!selectedUserId.value) {
    return null;
  }
  const user = users.value.find((u) => u.userId === selectedUserId.value);
  return user?.stats || null;
});

// Статистика выбранного диалога
const selectedDialogStats = computed(() => {
  if (!selectedDialogId.value) {
    return null;
  }
  const dialog = dialogs.value.find((d) => d.dialogId === selectedDialogId.value);
  return dialog?.stats || null;
});

// Модальное окно для информации о пользователе
const userInfoModal = useModal();
const { loading: loadingUserInfo, error: userInfoError, userData, loadUserInfo, clear: clearUserInfo } = useUserInfo();

async function handleShowUserInfo(userId: string) {
  userInfoModal.open();
  await loadUserInfo(userId);
}

function handleCloseUserInfo() {
  userInfoModal.close();
  clearUserInfo();
}

function copyUserJson() {
  if (userData.value) {
    const jsonStr = JSON.stringify(userData.value, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('JSON скопирован в буфер обмена');
    }).catch((err) => {
      console.error('Ошибка копирования:', err);
      alert('Ошибка копирования в буфер обмена');
    });
  }
}

// Модальное окно для информации о диалоге
const dialogInfoModal = useModal();
const { loading: loadingDialogInfo, error: dialogInfoError, dialogData, loadDialogInfo, clear: clearDialogInfo } = useDialogInfo();

async function handleShowDialogInfo(dialogId: string) {
  dialogInfoModal.open();
  await loadDialogInfo(dialogId);
}

function handleCloseDialogInfo() {
  dialogInfoModal.close();
  clearDialogInfo();
}

function copyDialogJson() {
  if (dialogData.value) {
    const jsonStr = JSON.stringify(dialogData.value, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('JSON скопирован в буфер обмена');
    }).catch((err) => {
      console.error('Ошибка копирования:', err);
      alert('Ошибка копирования в буфер обмена');
    });
  }
}

// Функция для установки правильной высоты страницы чата
function setChatPageHeight() {
  const header = document.querySelector('.header') as HTMLElement;
  const headerHeight = header?.clientHeight || 115;
  const availableHeight = window.innerHeight - headerHeight;
  
  if (chatPageRef.value) {
    chatPageRef.value.style.height = `${availableHeight}px`;
    chatPageRef.value.style.maxHeight = `${availableHeight}px`;
  }
  
  // Также отключаем прокрутку у .content
  const content = document.querySelector('.content') as HTMLElement;
  if (content) {
    content.style.setProperty('overflow', 'hidden', 'important');
    content.style.setProperty('height', `${availableHeight}px`, 'important');
  }
}

onMounted(async () => {
  loadUsers();
  
  await nextTick();
  setChatPageHeight();
  
  // Применяем стили после небольшой задержки и при изменении размера окна
  setTimeout(setChatPageHeight, 100);
  setTimeout(setChatPageHeight, 500); // Дополнительная попытка
  window.addEventListener('resize', setChatPageHeight);
  
  // Сохраняем обработчик для очистки
  (window as any).__chatPageResizeHandler = setChatPageHeight;
  
  // Используем MutationObserver для отслеживания изменений DOM
  const observer = new MutationObserver(() => {
    setChatPageHeight();
  });
  
  if (chatPageRef.value) {
    observer.observe(chatPageRef.value, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }
  
  // Сохраняем observer для очистки
  (window as any).__chatPageObserver = observer;
});

// Отслеживаем загрузку сообщений и применяем стили после загрузки
watch([messages, loadingMessages, selectedDialogId], () => {
  nextTick(() => {
    setTimeout(setChatPageHeight, 50);
    setTimeout(setChatPageHeight, 200);
    setTimeout(setChatPageHeight, 500); // Дополнительные попытки
  });
}, { deep: true });

onBeforeUnmount(() => {
  // Восстанавливаем прокрутку при уходе со страницы
  const content = document.querySelector('.content') as HTMLElement;
  if (content) {
    content.style.removeProperty('overflow');
    content.style.removeProperty('height');
  }
  
  // Удаляем обработчик resize
  const handler = (window as any).__chatPageResizeHandler;
  if (handler) {
    window.removeEventListener('resize', handler);
    delete (window as any).__chatPageResizeHandler;
  }
  
  // Отключаем MutationObserver
  const observer = (window as any).__chatPageObserver;
  if (observer) {
    observer.disconnect();
    delete (window as any).__chatPageObserver;
  }
});
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 799px !important; /* Фиксированная высота: window.innerHeight - header (914 - 115) */
  max-height: 799px !important;
  min-height: 0;
  background: #f5f5f5;
  overflow: hidden;
}

.container {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  max-width: 1400px;
  margin: 0 auto;
  background: white;
  overflow: hidden;
}

.left-column {
  display: flex;
  flex-direction: column;
  width: 400px;
  min-width: 400px;
  border-right: 1px solid #e9ecef;
  background: white;
  overflow-y: auto;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid #e9ecef;
  background: white;
  flex-shrink: 0;
}

.controls-panel {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: white;
  flex-shrink: 0;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

.section-divider {
  height: 1px;
  background: #e9ecef;
  margin: 16px 0;
  width: 100%;
}

.right-column {
  display: flex;
  flex-direction: column;
  width: 600px;
  min-width: 600px;
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.input-container {
  flex-shrink: 0;
  border-top: 1px solid #e9ecef;
  background: white;
}

.members-column {
  display: flex;
  flex-direction: column;
  width: 200px;
  min-width: 200px;
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
  border-left: 1px solid #e9ecef;
}

/* Стили для модального окна информации о пользователе */
.user-info-loading,
.user-info-error {
  padding: 20px;
  text-align: center;
}

.user-info-error {
  color: #d32f2f;
}

.user-info-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.user-info-url {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  color: #495057;
}

.user-info-json {
  max-height: 500px;
  overflow: auto;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.btn-copy,
.btn-close {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-copy {
  background: #007bff;
  color: white;
  margin-right: 10px;
}

.btn-copy:hover {
  background: #0056b3;
}

.btn-close {
  background: #6c757d;
  color: white;
}

.btn-close:hover {
  background: #5a6268;
}

/* Стили для модального окна информации о диалоге */
.dialog-info-loading,
.dialog-info-error {
  padding: 20px;
  text-align: center;
}

.dialog-info-error {
  color: #d32f2f;
}

.dialog-info-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.dialog-info-url {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  color: #495057;
}

.dialog-info-json {
  max-height: 500px;
  overflow: auto;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.add-dialog-button {
  margin-top: 8px;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: #28a745;
  color: white;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.2s;
}

.add-dialog-button:hover:not(:disabled) {
  background: #218838;
}

.add-dialog-button:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
