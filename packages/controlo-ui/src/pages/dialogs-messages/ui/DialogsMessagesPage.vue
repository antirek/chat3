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

        <div class="filter-panel" id="combinedForm">
          <div class="form-section">
            <label>🔍 Фильтр:</label>
            <select id="filterExample" v-model="selectedFilterExample" @change="updateFilterInput">
              <option value="">Выберите пример фильтра</option>
              <option value="(meta.channelType,eq,whatsapp)">meta. Тип канала = whatsapp</option>
              <option value="(meta.channelType,ne,telegram)">meta. Тип канала ≠ telegram</option>
              <option value="(meta.type,eq,internal)">meta. Тип диалога = internal</option>
              <option value="(meta.type,ne,external)">meta. Тип диалога ≠ external</option>
              <option value="(meta.securityLevel,eq,high)">meta. Уровень безопасности = high</option>
              <option value="(meta.securityLevel,in,[high,medium])">meta. Уровень безопасности в [high,medium]</option>
              <option value="(meta.maxParticipants,gt,50)">meta. Макс. участников > 50</option>
              <option value="(meta.maxParticipants,gte,100)">meta. Макс. участников ≥ 100</option>
              <option value="(meta.channelType,regex,^whats)">meta. Тип канала начинается с 'whats'</option>
              <option value="(meta.channelType,eq,whatsapp)&(meta.securityLevel,in,[high,medium])">meta. WhatsApp + высокий/средний уровень безопасности</option>
              <option value="(meta.type,eq,internal)&(meta.maxParticipants,eq,50)">meta. Внутренний + 50 участников</option>
              <option value="(meta.channelType,eq,telegram)&(meta.securityLevel,eq,high)">meta. Telegram + высокий уровень безопасности</option>
              <option value="(member,eq,carl)">👤 Диалоги с Carl</option>
              <option value="(member,eq,marta)">👤 Диалоги с Marta</option>
              <option value="(member,eq,sara)">👤 Диалоги с Sara</option>
              <option value="(member,eq,kirk)">👤 Диалоги с Kirk</option>
              <option value="(member,eq,john)">👤 Диалоги с John</option>
              <option value="(member,in,[carl,marta])">👥 Диалоги с Carl или Marta</option>
              <option value="(member,in,[sara,kirk,john])">👥 Диалоги с Sara, Kirk или John</option>
              <option value="(member,all,[carl,marta])">👥 Диалоги с Carl И Marta (оба участника)</option>
              <option value="(member,all,[carl,sara,kirk])">👥 Диалоги с Carl, Sara И Kirk (все трое)</option>
              <option value="(member,eq,carl)&(meta.channelType,eq,whatsapp)">👤 Carl + WhatsApp</option>
              <option value="(member,eq,marta)&(meta.type,eq,internal)">👤 Marta + Внутренний</option>
              <option value="(member,eq,sara)&(meta.securityLevel,eq,high)">👤 Sara + Высокий уровень безопасности</option>
              <option value="(member,in,[carl,marta])&(meta.channelType,eq,telegram)">👥 Carl/Marta + Telegram</option>
              <option value="(member,eq,kirk)&(meta.maxParticipants,gte,50)">👤 Kirk + ≥50 участников</option>
              <option value="(member,eq,john)&(meta.channelType,eq,whatsapp)&(meta.securityLevel,eq,high)">👤 John + WhatsApp + Высокий уровень</option>
              <option value="(member,all,[carl,marta])&(meta.type,eq,internal)&(meta.maxParticipants,eq,50)">👥 Carl+Marta + Внутренний + 50 участников</option>
              <option value="(member,in,[sara,kirk])&(meta.channelType,in,[whatsapp,telegram])&(meta.securityLevel,in,[high,medium])">👥 Sara/Kirk + WhatsApp/Telegram + Высокий/Средний уровень</option>
              <option value="(member[carl].unreadCount,gte,4)&(meta.channelType,eq,whatsapp)">📬 Carl ≥4 непрочитанных + WhatsApp</option>
              <option value="(member[carl].unreadCount,eq,0)&(meta.type,eq,internal)">📬 Carl 0 непрочитанных + Внутренний</option>
              <option value="(member[carl].unreadCount,gte,2)&(meta.securityLevel,eq,high)">📬 Carl ≥2 непрочитанных + Высокий уровень</option>
              <option value="custom">Пользовательский фильтр</option>
            </select>
            <div class="input-with-clear">
              <input type="text" id="filterValue" v-model="filterValue" placeholder="Введите или выберите фильтр" />
              <button class="clear-field" @click="clearAll" title="Очистить фильтр">✕</button>
            </div>
          </div>

          <div class="form-section">
            <label>🔄 Сортировка:</label>
            <select id="sortExample" v-model="selectedSortExample" @change="updateSortInput">
              <option value="">Выберите пример сортировки</option>
              <option value="(createdAt,desc)">🕒 Создание диалога (новые сверху)</option>
              <option value="(createdAt,asc)">🕒 Создание диалога (старые сверху)</option>
              <option value="(member[carl].unreadCount,desc)">📬 Непрочитанные Carl (больше сверху)</option>
              <option value="(member[carl].unreadCount,asc)">📬 Непрочитанные Carl (меньше сверху)</option>
              <option value="(member[marta].unreadCount,desc)">📬 Непрочитанные Marta (больше сверху)</option>
              <option value="(member[marta].unreadCount,asc)">📬 Непрочитанные Marta (меньше сверху)</option>
              <option value="(member[sara].unreadCount,desc)">📬 Непрочитанные Sara (больше сверху)</option>
              <option value="(member[sara].unreadCount,asc)">📬 Непрочитанные Sara (меньше сверху)</option>
              <option value="(member[kirk].unreadCount,desc)">📬 Непрочитанные Kirk (больше сверху)</option>
              <option value="(member[kirk].unreadCount,asc)">📬 Непрочитанные Kirk (меньше сверху)</option>
              <option value="(member[john].unreadCount,desc)">📬 Непрочитанные John (больше сверху)</option>
              <option value="(member[john].unreadCount,asc)">📬 Непрочитанные John (меньше сверху)</option>
              <option value="custom">Пользовательская сортировка</option>
            </select>
            <div class="input-with-clear">
              <input type="text" id="sortValue" v-model="sortValue" placeholder="Введите или выберите сортировку" />
              <button class="clear-field" @click="clearAll" title="Очистить сортировку">✕</button>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-primary" @click="applyCombined" :disabled="applying">
              {{ applying ? 'Применяется...' : applyButtonText }}
            </button>
          </div>
        </div>

        <div class="pagination" id="dialogsPagination" v-show="showDialogsPagination">
          <button @click="changePage(currentPage - 1)" :disabled="currentPage <= 1">← Предыдущая</button>
          <button
            v-for="pageNum in visibleDialogPages"
            :key="pageNum"
            :class="{ active: pageNum === currentPage }"
            @click="changePage(pageNum)"
          >
            {{ pageNum }}
          </button>
          <button @click="changePage(currentPage + 1)" :disabled="currentPage >= totalPages">
            Следующая →
          </button>
          <span>Страница {{ currentPage }} из {{ totalPages }} (всего {{ totalDialogs }} диалогов)</span>
        </div>

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

        <div class="filter-panel" id="messageFilterForm" v-show="currentDialogId">
          <div class="form-section">
            <label>🔍 Фильтр:</label>
            <select id="messageFilterExample" v-model="selectedMessageFilterExample" @change="updateMessageFilterInput">
              <option value="">Выберите пример фильтра</option>
              <option value="(content,regex,встретимся)">📝 Содержит "встретимся"</option>
              <option value="(content,regex,спасибо)">📝 Содержит "спасибо"</option>
              <option value="(content,regex,привет)">📝 Содержит "привет"</option>
              <option value="(type,eq,internal.text)">📝 Тип = internal.text</option>
              <option value="(type,eq,system)">📝 Тип = system</option>
              <option value="(senderId,eq,carl)">👤 Отправитель = carl</option>
              <option value="(senderId,eq,sara)">👤 Отправитель = sara</option>
              <option value="custom">✏️ Пользовательский фильтр</option>
            </select>
            <div class="input-with-clear">
              <input
                type="text"
                id="messageFilterValue"
                v-model="messageFilterValue"
                placeholder="Введите или выберите фильтр"
              />
              <button class="clear-field" @click="clearMessageFilter" title="Очистить фильтр">✕</button>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-primary" @click="applyMessageFilter">Применить</button>
          </div>
        </div>

        <div class="pagination" id="messagesPagination" v-show="showMessagesPagination">
          <button @click="changeMessagePage(currentMessagePage - 1)" :disabled="currentMessagePage <= 1">
            ← Предыдущая
          </button>
          <button
            v-for="pageNum in visibleMessagePages"
            :key="pageNum"
            :class="{ active: pageNum === currentMessagePage }"
            @click="changeMessagePage(pageNum)"
          >
            {{ pageNum }}
          </button>
          <button
            @click="changeMessagePage(currentMessagePage + 1)"
            :disabled="currentMessagePage >= totalMessagePages"
          >
            Следующая →
          </button>
          <span>Страница {{ currentMessagePage }} из {{ totalMessagePages }} (всего {{ totalMessages }} сообщений)</span>
        </div>

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
  </div>
</template>

<script setup lang="ts">
import { useDialogsMessagesPage } from '../model/useDialogsMessagesPage';
import { DialogTable, DialogInfoModal, CreateDialogModal } from '@/entities/dialog/ui';
import { MessagesTableSimple } from '@/entities/message/ui';

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
  updateFilterInput,
  updateSortInput,
  clearAll,
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
  updateMessageFilterInput,
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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px;
  gap: 5px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.pagination button {
  padding: 5px 10px;
  border: 1px solid #ced4da;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
}

.pagination button:hover:not(:disabled) {
  background: #e9ecef;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination button.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.pagination span {
  margin-left: 15px;
  color: #6c757d;
  font-size: 12px;
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
