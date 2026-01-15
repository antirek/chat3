<template>
  <div class="dialogs-messages-page">
    <div class="container">
      <!-- Диалоги -->
      <div class="panel dialogs-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>💬 Диалоги</span>
            <button @click="showAddDialogModal" class="url-button" title="Создать диалог">➕ Добавить</button>
          </div>
          <div class="header-right">
            <button @click="showCurrentUrl" class="url-button" title="Показать URL запроса">🔗 URL</button>
          </div>
        </div>

        <DialogFilterPanel
          v-model:filter-value="filterValue"
          v-model:selected-filter-example="selectedFilterExample"
          v-model:sort-value="sortValue"
          v-model:selected-sort-example="selectedSortExample"
          :applying="applying"
          :button-text="applyButtonText"
          @apply="applyCombined"
        />

        <DialogsPagination
          :show="showDialogsPagination"
          :current-page="currentPage"
          :total-pages="totalPages"
          :total="totalDialogs"
          :visible-pages="visibleDialogPages"
          @change="changePage"
        />

        <DialogTable
          :dialogs="dialogs"
          :loading="loadingDialogs"
          :error="dialogsError"
          :current-dialog-id="currentDialogId"
          :current-sort="currentSort"
          :get-sort-indicator="getDialogSortIndicator"
          :format-updated-at="formatUpdatedAt"
          :format-members="formatMembers"
          @toggle-sort="toggleSort"
          @select-dialog="selectDialog"
          @show-info="showDialogInfo"
        />
      </div>

      <!-- Сообщения -->
      <div class="panel messages-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>📝 Сообщения</span>
          </div>
          <div class="header-right">
            <button
              @click="showCurrentMessageUrl"
              class="url-button"
              title="Показать URL запроса"
              v-show="currentDialogId"
            >
              🔗 URL
            </button>
          </div>
        </div>

        <MessageFilterPanel
          v-show="currentDialogId"
          v-model:filter-value="messageFilterValue"
          v-model:selected-example="selectedMessageFilterExample"
          @clear="clearMessageFilter"
          @apply="applyMessageFilter"
        />

        <MessagesPagination
          :show="showMessagesPagination"
          :current-page="currentMessagePage"
          :total-pages="totalMessagePages"
          :total="totalMessages"
          :visible-pages="visibleMessagePages"
          @change="changeMessagePage"
        />

        <MessagesTableSimple
          :messages="messages"
          :loading="loadingMessages"
          :error="messagesError"
          :current-dialog-id="currentDialogId"
          :current-sort="currentMessageSort"
          :get-sort-indicator="getMessageSortIndicator"
          :toggle-sort="toggleMessageSort"
          :format-timestamp="formatMessageTime"
          :show-info="showMessageInfo"
        />
      </div>
    </div>

    <DialogInfoModal
      :is-open="showInfoModalFlag"
      :title="modalTitle"
      :content="modalBody"
      @close="closeModal"
    />

    <CreateDialogModal
      :is-open="showCreateDialogModalFlag"
      :users="usersForDialog"
      :loading-users="loadingUsers"
      :users-error="usersError"
      :users-loaded="usersLoaded"
      :selected-members="selectedMembers"
      @close="closeCreateDialogModal"
      @load-users="loadUsersForDialog"
      @create="createDialog"
      @update:selected-members="selectedMembers = $event"
    />
    
    <UrlModal
      :is-open="showUrlModal"
      :title="urlModalTitle"
      :url="urlModalUrl"
      :copy-button-text="urlCopyButtonText"
      @close="closeUrlModal"
      @copy="copyUrlToClipboard"
    />
  </div>
</template>

<script setup lang="ts">
import { useDialogsMessagesPage } from '../model/useDialogsMessagesPage';
import { DialogTable, MessagesTableSimple } from './tables';
import { DialogInfoModal, CreateDialogModal, UrlModal } from './modals';
import { DialogsPagination, MessagesPagination } from './pagination';
import { DialogFilterPanel, MessageFilterPanel } from './filters';

const {
  // Диалоги
  dialogs,
  loadingDialogs,
  dialogsError,
  currentPage,
  totalPages,
  totalDialogs,
  visibleDialogPages,
  currentSort,
  filterValue,
  sortValue,
  selectedFilterExample,
  selectedSortExample,
  applying,
  applyButtonText,
  showDialogsPagination,
  // Сообщения
  messages,
  loadingMessages,
  messagesError,
  currentDialogId,
  currentMessagePage,
  totalMessagePages,
  totalMessages,
  visibleMessagePages,
  currentMessageSort,
  messageFilterValue,
  selectedMessageFilterExample,
  showMessagesPagination,
  // Модальные окна
  showInfoModalFlag,
  showCreateDialogModalFlag,
  modalTitle,
  modalBody,
  // Создание диалога
  usersForDialog,
  loadingUsers,
  usersError,
  usersLoaded,
  selectedMembers,
  // Функции
  applyCombined,
  changePage,
  formatUpdatedAt,
  formatMembers,
  selectDialog,
  changeMessagePage,
  formatMessageTime,
  toggleSort,
  getDialogSortIndicator,
  toggleMessageSort,
  getMessageSortIndicator,
  applyMessageFilter,
  clearMessageFilter,
  showCurrentMessageUrl,
  showCurrentUrl,
  showAddDialogModal,
  closeCreateDialogModal,
  loadUsersForDialog,
  createDialog,
  showDialogInfo,
  showMessageInfo,
  closeModal,
  // URL модалка
  showUrlModal,
  urlModalTitle,
  urlModalUrl,
  urlCopyButtonText,
  closeUrlModal,
  copyUrlToClipboard,
} = useDialogsMessagesPage();
</script>

<style scoped>
/* Переносим все стили из оригинального HTML */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.dialogs-messages-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.container {
  display: flex;
  flex: 1;
  gap: 1px;
  background: #ddd;
}

.dialogs-panel {
  width: 50%;
  min-width: 350px;
}

.messages-panel {
  width: 50%;
  min-width: 350px;
}

.panel {
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #495057;
  font-size: 16px;
  min-height: 59px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.url-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: normal;
  transition: background-color 0.2s;
}

.url-button:hover {
  background: #5a6fd8;
}

.filter-panel {
  padding: 15px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.form-section {
  margin-bottom: 12px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.form-section select,
.form-section input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
  margin-bottom: 8px;
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.input-with-clear input {
  padding-right: 35px;
  margin-bottom: 0;
}

.clear-field {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-field:hover {
  color: #dc3545;
}

.form-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e9ecef;
}

th[style*='cursor: pointer'] {
  cursor: pointer;
  user-select: none;
}

th[style*='cursor: pointer']:hover {
  background: #e9ecef;
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid #e9ecef;
  font-size: 12px;
}

tr:hover {
  background: #f8f9fa;
}

.dialog-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.dialog-row:hover {
  background: #f0f0f0 !important;
}

.dialog-row-selected {
  background: #e3f2fd !important;
}

.dialog-row-selected:hover {
  background: #d1e7ff !important;
}

.info-button {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid #8ba0f5;
  background: #8ba0f5;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  max-height: 25px;
  min-width: 69px;
}

.info-button:hover {
  background: #7c8ff0;
  border-color: #7c8ff0;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}

.sort-indicator.active {
  font-weight: bold;
}

.loading,
.error,
.no-data,
.placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.error {
  color: #dc3545;
}

.message-content {
  max-width: 100%;
  word-wrap: break-word;
  white-space: pre-wrap;
}

/* Модальное окно */
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: #fefefe;
  margin: 5% auto;
  padding: 20px;
  border: none;
  border-radius: 8px;
  width: 80%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e9ecef;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.close {
  font-size: 28px;
  font-weight: bold;
  color: #aaa;
  cursor: pointer;
  line-height: 1;
}

.close:hover {
  color: #000;
}

.modal-body {
  color: #333;
  font-size: 13px;
}

.member-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-checkbox {
  margin-right: 10px;
  cursor: pointer;
}

.member-item label {
  cursor: pointer;
  flex: 1;
  margin: 0;
}
</style>
