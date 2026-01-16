<template>
  <div class="user-dialogs-page">
    <div class="container">
      <!-- Пользователи -->
      <div class="panel users-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>👥 Пользователи</span>
          </div>
          <div class="header-right">
            <button @click="showUsersUrl" class="url-button" title="Показать URL запроса">🔗 URL</button>
          </div>
        </div>
        <FilterPanel
          input-id="userFilterInput"
          select-id="userFilterExample"
          label="Фильтр пользователей (формат: (поле,оператор,значение))"
          :filter-value="userFilterInput"
          :selected-example="selectedUserFilterExample"
          :examples="userFilterExamples"
          placeholder="Например: (userId,regex,carl)&(meta.role,eq,manager)"
          hint="Поддерживаются поля userId, name, а также meta.*. Операторы: eq, regex, in, nin, gt, gte, lt, lte, ne и др."
          form-style="border-bottom: 1px solid #e9ecef;"
          @update:filter-value="userFilterInput = $event"
          @update:selected-example="selectedUserFilterExample = $event"
          @select-example="selectUserFilterExample"
          @clear="clearUserFilter"
          @apply="applyUserFilter"
        />
        <UsersPagination
          :current-page="currentUserPage"
          :current-page-input="currentUserPageInput"
          :total-pages="totalUserPages"
          :total="totalUsers"
          :pagination-start="userPaginationStart"
          :pagination-end="userPaginationEnd"
          :limit="currentUserLimit"
          @first="goToUsersFirstPage"
          @prev="goToUsersPreviousPage"
          @next="goToUsersNextPage"
          @last="goToUsersLastPage"
          @go-to-page="goToUsersPage"
          @change-limit="changeUserLimit"
        />
        <UsersTable
          :users="users"
          :loading="loadingUsers"
          :error="usersError"
          :selected-user-id="currentUserId"
          @select="selectUser"
          @show-info="showUserInfoModal"
        />
      </div>

      <!-- Диалоги -->
      <div class="panel dialogs-panel">
        <div class="panel-header">
          <div class="header-left">
            <span>💬 Диалоги{{ currentUserName ? ` пользователя ${currentUserName}` : '' }}</span>
          </div>
          <div class="header-right">
            <button
              id="viewUrlBtn"
              class="view-url-btn"
              @click="showCurrentUrl"
              title="Просмотреть текущий URL запроса"
            >
              🔗 URL
            </button>
          </div>
        </div>
        <FilterPanel
          v-show="currentUserId"
          input-id="filterValue"
          select-id="filterExample"
          label="Фильтр:"
          :filter-value="filterValue"
          :selected-example="selectedFilterExample"
          :examples="dialogFilterExamples"
          placeholder="Введите или выберите фильтр"
          @update:filter-value="filterValue = $event"
          @update:selected-example="selectedFilterExample = $event"
          @select-example="selectFilterExample"
          @clear="clearFilter"
          @apply="applyFilter"
        />
        <Pagination
          v-show="showDialogsPagination"
          :current-page="currentDialogPage"
          :total-pages="totalDialogPages"
          :total="totalDialogs"
          :info-text="`Страница ${currentDialogPage} из ${totalDialogPages} (всего ${totalDialogs} диалогов)`"
          :visible-pages="visibleDialogPages"
          :show-page-numbers="true"
          @change="changeDialogPage"
        />
        <DialogsTable
          :dialogs="dialogs"
          :loading="loadingDialogs"
          :error="dialogsError"
          :selected-dialog-id="currentDialogId"
          :has-user="!!currentUserId"
          @select="selectDialog"
          @show-info="showDialogInfo"
          @show-events="showDialogEventsModal"
          @show-meta="showDialogMetaModal"
        />
      </div>

      <!-- Сообщения / Участники / Топики -->
      <div class="panel messages-panel">
        <!-- Вкладки -->
        <div v-if="currentDialogId" class="tabs-container">
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'messages' }"
            @click="selectDialog(currentDialogId!)"
          >
            📝 Сообщения
          </button>
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'members' }"
            @click="selectDialogMembers(currentDialogId!)"
          >
            👥 Участники
          </button>
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'topics' }"
            @click="selectDialogTopics(currentDialogId!)"
          >
            📌 Топики
          </button>
        </div>
        <div class="panel-header">
          <div class="header-left">
            <button
              v-if="currentDialogId && currentViewMode === 'messages'"
              @click="showAddMessageModal"
              class="url-button"
              title="Добавить сообщение"
              id="addMessageBtn"
            >
              ➕ Добавить
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'members'"
              @click="showAddMemberModal"
              class="url-button"
              title="Добавить участника"
              id="addMemberBtn"
            >
              ➕ Добавить
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'topics'"
              @click="showAddTopicModal"
              class="url-button"
              title="Создать топик"
              id="addTopicBtn"
            >
              ➕ Создать
            </button>
          </div>
          <div class="header-right">
            <button
              v-if="currentDialogId && currentViewMode === 'messages'"
              @click="showCurrentMessageUrl"
              class="url-button"
              title="Показать URL запроса"
              id="messageUrlBtn"
            >
              🔗 URL
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'members'"
              @click="showMembersUrlModal"
              class="url-button"
              title="Показать URL API"
              id="membersUrlBtn"
            >
              🔗 URL
            </button>
            <button
              v-if="currentDialogId && currentViewMode === 'topics'"
              @click="showTopicsUrlModal"
              class="url-button"
              title="Показать URL API"
              id="topicsUrlBtn"
            >
              🔗 URL
            </button>
          </div>
        </div>
        <FilterPanel
          v-show="currentDialogId && currentViewMode === 'messages'"
          input-id="messageFilterInput"
          select-id="messageFilterExample"
          label="Фильтр сообщений:"
          :filter-value="messageFilterInput"
          :selected-example="selectedMessageFilterExample"
          :examples="messageFilterExamples"
          placeholder="Введите или выберите фильтр сообщений"
          @update:filter-value="messageFilterInput = $event"
          @update:selected-example="selectedMessageFilterExample = $event"
          @select-example="selectMessageFilterExample"
          @clear="clearMessageFilter"
          @apply="applyMessageFilter"
        />
        <!-- Сообщения -->
        <Pagination
          v-show="currentViewMode === 'messages' && showMessagesPagination"
          :current-page="currentMessagePage"
          :total-pages="totalMessagePages"
          :total="totalMessages"
          :info-text="`Страница ${currentMessagePage} из ${totalMessagePages} (всего ${totalMessages} сообщений)`"
          :visible-pages="visibleMessagePages"
          :show-page-numbers="true"
          container-style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;"
          @change="changeMessagePage"
        />
        <div class="panel-content" id="messagesList" v-show="currentViewMode === 'messages'">
          <MessagesTable
            :messages="messages"
            :loading="loadingMessages"
            :error="messagesError"
            :has-dialog="!!currentDialogId"
            @show-info="showMessageInfo"
            @show-meta="showMessageMetaModal"
            @show-reactions="showReactionModal"
            @show-events="showEventsModal"
            @show-status-matrix="showStatusMatrixModal"
            @show-statuses="showStatusesModal"
            @show-set-status="showSetStatusModal"
          />
        </div>

        <!-- Топики -->
        <div id="topicsPanelContent" v-show="currentViewMode === 'topics'" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <TopicsTable
            :topics="topics"
            :loading="loadingTopics"
            :error="topicsError"
            @show-meta="(topicId) => currentDialogId && showTopicMetaModal(currentDialogId, topicId)"
          />
          <Pagination
            v-if="totalTopicsPages > 1"
            :current-page="currentTopicsPage"
            :total-pages="totalTopicsPages"
            :info-text="`Страница ${currentTopicsPage} из ${totalTopicsPages}`"
            container-style="margin-top: 15px; padding: 0 20px;"
            @change="(page: number) => currentDialogId && loadDialogTopics(currentDialogId, page)"
          />
        </div>

        <!-- Участники -->
        <div id="membersPanelContent" v-show="currentViewMode === 'members'" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          
          <div id="membersListSectionPanel" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <FilterPanel
              input-id="memberFilterInputPanel"
              select-id="memberFilterExamplePanel"
              label="Фильтр участников (формат: (поле,оператор,значение))"
              :filter-value="memberFilterInput"
              :selected-example="selectedMemberFilterExample"
              :examples="memberFilterExamples"
              placeholder="Например: (userId,regex,carl)&(meta.role,eq,agent)"
              hint="Поддерживаются поля userId, isActive, unreadCount, joinedAt, meta.*. Операторы: eq, ne, regex, in, nin, gt, gte, lt, lte."
              form-style="border-bottom: 1px solid #e9ecef; padding: 15px 20px;"
              @update:filter-value="memberFilterInput = $event"
              @update:selected-example="selectedMemberFilterExample = $event"
              @select-example="selectMemberFilterExamplePanel"
              @clear="clearMemberFilterFieldPanel"
              @apply="applyMemberFilterPanel"
            />
            
            <!-- Пагинация участников -->
            <Pagination
              v-show="totalMembers > 0"
              :current-page="currentMemberPage"
              :total-pages="totalMemberPages"
              :total="totalMembers"
              :info-text="`Страница ${currentMemberPage} из ${totalMemberPages} (всего ${totalMembers} участников)`"
              :visible-pages="visibleMemberPages"
              :show-page-numbers="true"
              container-style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;"
              @change="changeMemberPage"
            />
            
            <!-- Таблица участников -->
            <MembersTable
              :members="members"
              :loading="loadingMembers"
              :error="membersError"
              @show-meta="(userId) => currentDialogId && showMemberMetaModal(currentDialogId, userId)"
              @remove="(userId) => currentDialogId && removeMemberFromPanel(currentDialogId, userId)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно для информации -->
    <InfoModal
      :is-open="isInfoModalOpen"
      :title="modalTitle"
      :body="modalBody"
      @close="closeModal"
    />

    <!-- Модальное окно для добавления сообщения -->
    <AddMessageModal
      :is-open="isAddMessageModalOpen"
      :current-dialog-id="currentDialogId"
      v-model:sender="messageSender"
      v-model:type="messageType"
      v-model:topic-id="messageTopicId"
      v-model:content="messageContent"
      v-model:quoted-message-id="quotedMessageId"
      v-model:meta-tags="messageMetaTags"
      :available-topics="availableTopics"
      @close="closeAddMessageModal"
      @add-meta-tag="addMetaTagRow"
      @remove-meta-tag="removeMetaTagRow"
      @submit="submitAddMessage"
    />

    <!-- Модальное окно для добавления реакции -->
    <ReactionModal
      :is-open="isReactionModalOpen"
      :existing-reactions="existingReactions"
      @close="closeReactionModal"
      @toggle-reaction="toggleReaction"
    />

    <!-- Модальное окно для просмотра событий сообщения -->
    <EventsModal
      :is-open="isEventsModalOpen"
      :events="events"
      :event-updates="eventUpdates"
      :loading="loadingEvents"
      :error="eventsError"
      :get-event-id="getEventId"
      :get-event-description="getEventDescription"
      :format-event-time="formatEventTime"
      @close="closeEventsModal"
      @load-updates="loadEventUpdates"
    />

    <!-- Модальное окно для просмотра событий диалога -->
    <DialogEventsModal
      :is-open="isDialogEventsModalOpen"
      :events="dialogEvents"
      :dialog-event-updates="dialogEventUpdates"
      :loading="loadingDialogEvents"
      :error="dialogEventsError"
      :dialog-id="currentDialogIdForEvents"
      :selected-event-id="selectedDialogEventId"
      :get-dialog-event-id="getDialogEventId"
      :get-dialog-event-description="getDialogEventDescription"
      :format-event-time="formatEventTime"
      :get-update-id="getUpdateId"
      @close="closeDialogEventsModal"
      @load-updates="loadAllDialogUpdatesInModal"
    />

    <!-- Модальное окно для просмотра матрицы статусов сообщения -->
    <StatusMatrixModal
      :is-open="isStatusMatrixModalOpen"
      :status-matrix="statusMatrix"
      :loading="loadingStatusMatrix"
      :error="statusMatrixError"
      :url="statusMatrixUrl"
      @close="closeStatusMatrixModal"
    />

    <!-- Модальное окно для просмотра статусов сообщения -->
    <StatusesModal
      :is-open="isStatusesModalOpen"
      :statuses="statuses"
      :loading="loadingStatuses"
      :error="statusesError"
      :url="statusesUrl"
      :total="totalStatuses"
      :current-page="currentStatusesPage"
      :total-pages="totalStatusesPages"
      :format-event-time="formatEventTime"
      @close="closeStatusesModal"
      @go-to-page="goToStatusesPage"
    />

    <!-- Модальное окно мета-тегов диалога -->
    <MetaModal
      :is-open="isDialogMetaModalOpen"
      title="🏷️ Meta теги диалога"
      :loading="loadingDialogMeta"
      :meta-tags="dialogMetaTags"
      key-placeholder="key (например: type)"
      value-placeholder='value (например: "internal" или {"foo": "bar"})'
      @close="closeDialogMetaModal"
      @add-tag="(key, value) => { newDialogMetaKey = key; newDialogMetaValue = value; addDialogMetaTag(); }"
      @delete-tag="deleteDialogMetaTag"
    />

    <!-- Модальное окно для установки статуса сообщения -->
    <SetStatusModal
      :is-open="isSetStatusModalOpen"
      :url="undefined"
      :result="setStatusResult"
      @close="closeSetStatusModal"
      @set-status="setMessageStatus"
    />

    <!-- Модальное окно мета-тегов сообщения -->
    <MetaModal
      :is-open="isMessageMetaModalOpen"
      title="🏷️ Meta теги сообщения"
      :loading="loadingMessageMeta"
      :meta-tags="messageMetaTagsData"
      key-placeholder="key (например: channelType)"
      value-placeholder='value (например: "whatsapp" или {"foo": "bar"})'
      @close="closeMessageMetaModal"
      @add-tag="(key, value) => { newMessageMetaKey = key; newMessageMetaValue = value; addMessageMetaTag(); }"
      @delete-tag="deleteMessageMetaTag"
    />

    <!-- Модальное окно для добавления участника -->
    <AddMemberModal
      :is-open="isAddMemberModalOpen"
      :available-users="availableUsersForMember"
      :selected-user="newMemberSelect"
      :member-type="newMemberType"
      :meta-tags="newMemberMetaTags"
      @close="closeAddMemberModal"
      @submit="submitAddMember"
      @update:selected-user="newMemberSelect = $event"
      @update:member-type="newMemberType = $event"
      @add-meta-row="addMemberMetaRow"
      @remove-meta-row="removeMemberMetaRow"
      @update-meta-key="(i, v) => newMemberMetaTags[i].key = v"
      @update-meta-value="(i, v) => newMemberMetaTags[i].value = v"
    />

    <!-- Модальное окно для редактирования мета-тегов участника -->
    <MemberMetaModal
      :is-open="isMemberMetaModalOpen"
      :dialog-id="memberMetaModalDialogId"
      :user-id="memberMetaModalUserId"
      :meta-tags="memberMetaTags"
      :status="memberMetaStatus"
      @close="closeMemberMetaModal"
      @save="saveMemberMetaChangesModal"
      @add-meta-row="addMemberMetaRowModal"
      @remove-meta-row="removeMemberMetaRowModal"
      @update-meta-key="(i, v) => memberMetaTags[i].key = v"
      @update-meta-value="(i, v) => memberMetaTags[i].value = v"
    />

    <!-- Модальное окно для создания топика -->
    <AddTopicModal
      :is-open="isAddTopicModalOpen"
      :meta-tags="newTopicMetaTags"
      @close="closeAddTopicModal"
      @submit="submitAddTopic"
      @add-meta-row="addTopicMetaRow"
      @remove-meta-row="removeTopicMetaRow"
      @update-meta-key="(i, v) => newTopicMetaTags[i].key = v"
      @update-meta-value="(i, v) => newTopicMetaTags[i].value = v"
    />

    <!-- Модальное окно для мета-тегов топика -->
    <TopicMetaModal
      :is-open="isTopicMetaModalOpen"
      :meta-tags="topicMetaTags"
      :loading="loadingTopicMeta"
      :new-key="newTopicMetaKey"
      :new-value="newTopicMetaValue"
      @close="closeTopicMetaModal"
      @delete-tag="deleteTopicMetaTag"
      @add-tag="addTopicMetaTag"
      @update:new-key="newTopicMetaKey = $event"
      @update:new-value="newTopicMetaValue = $event"
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
import { onMounted } from 'vue';
import { useUserDialogsPage } from '../model/useUserDialogsPage';
import {
  InfoModal,
  AddMessageModal,
  ReactionModal,
  MetaModal,
  SetStatusModal,
  EventsModal,
  DialogEventsModal,
  StatusMatrixModal,
  StatusesModal,
  AddMemberModal,
  MemberMetaModal,
  AddTopicModal,
  TopicMetaModal,
  UrlModal,
} from './modals';
import {
  FilterPanel,
  userFilterExamples,
  dialogFilterExamples,
  messageFilterExamples,
  memberFilterExamples,
} from './filters';
import { Pagination, UsersPagination } from './pagination';
import { UsersTable, DialogsTable, MessagesTable, TopicsTable, MembersTable } from './tables';

// Используем composable
const pageData = useUserDialogsPage();

// Деструктурируем только то, что нужно в template
const {
  // Users
  loadingUsers,
  usersError,
  users,
  currentUserId,
  currentUserName,
  userPaginationStart,
  userPaginationEnd,
  // Users Pagination
  currentUserPage,
  currentUserPageInput,
  currentUserLimit,
  totalUserPages,
  totalUsers,
  // Users Filter
  userFilterInput,
  selectedUserFilterExample,
  // Dialogs
  loadingDialogs,
  dialogsError,
  dialogs,
  currentDialogId,
  showDialogsPagination,
  visibleDialogPages,
  // Dialogs Pagination
  currentDialogPage,
  totalDialogPages,
  totalDialogs,
  // Dialogs Filter
  filterValue,
  selectedFilterExample,
  // Messages
  loadingMessages,
  messagesError,
  messages,
  showMessagesPagination,
  visibleMessagePages,
  // Messages Pagination
  currentMessagePage,
  totalMessagePages,
  totalMessages,
  // Messages Filter
  messageFilterInput,
  selectedMessageFilterExample,
  // Members
  loadingMembers,
  membersError,
  members,
  visibleMemberPages,
  // Members Pagination
  currentMemberPage,
  totalMemberPages,
  totalMembers,
  // Members Filter
  memberFilterInput,
  selectedMemberFilterExample,
  // Topics
  loadingTopics,
  topicsError,
  topics,
  // Topics Pagination
  currentTopicsPage,
  totalTopicsPages,
  // View Mode
  currentViewMode,
  // Modals - flags
  isInfoModalOpen,
  isAddMessageModalOpen,
  isReactionModalOpen,
  isEventsModalOpen,
  isStatusMatrixModalOpen,
  isStatusesModalOpen,
  isSetStatusModalOpen,
  isDialogEventsModalOpen,
  isDialogMetaModalOpen,
  isAddMemberModalOpen,
  isAddTopicModalOpen,
  isMemberMetaModalOpen,
  isMessageMetaModalOpen,
  isTopicMetaModalOpen,
  modalTitle,
  modalBody,
  // Functions
  loadUsers,
  selectUserFilterExample,
  clearUserFilter,
  applyUserFilter,
  goToUsersFirstPage,
  goToUsersPreviousPage,
  goToUsersNextPage,
  goToUsersLastPage,
  goToUsersPage,
  changeUserLimit,
  selectUser,
  loadUserDialogs,
  selectFilterExample,
  clearFilter,
  applyFilter,
  changeDialogPage,
  selectDialog,
  selectDialogMembers,
  selectDialogTopics,
  loadDialogMessages,
  selectMessageFilterExample,
  clearMessageFilter,
  applyMessageFilter,
  changeMessagePage,
  loadDialogMembers,
  selectMemberFilterExamplePanel,
  clearMemberFilterFieldPanel,
  applyMemberFilterPanel,
  changeMemberPage,
  loadDialogTopics,
  formatLastSeen,
  formatMessageTime,
  shortenDialogId,
  shortenTopicId,
  getMessageStatus,
  getStatusIcon,
  getStatusColor,
  showModal,
  closeModal,
  showUsersUrl,
  showCurrentUrl,
  showCurrentMessageUrl,
  showDialogInfo,
  showMessageInfo,
  showUserInfoModal,
  // Добавление сообщения
  showAddMessageModal,
  closeAddMessageModal,
  addMetaTagRow,
  removeMetaTagRow,
  updatePayloadJson,
  submitAddMessage,
  messageSender,
  messageType,
  messageContent,
  messageTopicId,
  quotedMessageId,
  messageMetaTags,
  availableTopics,
  payloadJson,
  // Реакции
  showReactionModal,
  closeReactionModal,
  toggleReaction,
  existingReactions,
  // События сообщения
  showEventsModal,
  closeEventsModal,
  getEventId,
  formatEventTime,
  getEventDescription,
  loadEventUpdates,
  events,
  loadingEvents,
  eventsError,
  eventUpdates,
  // Статусы
  showStatusMatrixModal,
  closeStatusMatrixModal,
  showStatusesModal,
  closeStatusesModal,
  goToStatusesPage,
  showSetStatusModal,
  closeSetStatusModal,
  setMessageStatus,
  setStatusResult,
  loadingStatusMatrix,
  statusMatrixError,
  loadingStatuses,
  statusesError,
  statusesUrl,
  statusMatrixUrl,
  totalStatuses,
  statusMatrix,
  statuses,
  currentStatusesPage,
  totalStatusesPages,
  // События диалога
  showDialogEventsModal,
  closeDialogEventsModal,
  getDialogEventId,
  getUpdateId,
  getDialogEventDescription,
  loadAllDialogUpdatesInModal,
  currentDialogIdForEvents,
  dialogEvents,
  loadingDialogEvents,
  dialogEventsError,
  selectedDialogEventId,
  dialogEventUpdates,
  // Мета-теги диалога
  showDialogMetaModal,
  closeDialogMetaModal,
  addDialogMetaTag,
  deleteDialogMetaTag,
  dialogMetaTags,
  loadingDialogMeta,
  newDialogMetaKey,
  newDialogMetaValue,
  // Добавление участника
  showAddMemberModal,
  closeAddMemberModal,
  addMemberMetaRow,
  removeMemberMetaRow,
  submitAddMember,
  newMemberSelect,
  newMemberType,
  newMemberMetaTags,
  availableUsersForMember,
  // Создание топика
  showAddTopicModal,
  closeAddTopicModal,
  addTopicMetaRow,
  removeTopicMetaRow,
  submitAddTopic,
  newTopicMetaTags,
  // Мета-теги участника
  showMemberMetaModal,
  closeMemberMetaModal,
  addMemberMetaRowModal,
  removeMemberMetaRowModal,
  saveMemberMetaChangesModal,
  memberMetaModalDialogId,
  memberMetaModalUserId,
  memberMetaTags,
  memberMetaStatus,
  // Мета-теги сообщения
  showMessageMetaModal,
  closeMessageMetaModal,
  addMessageMetaTag,
  deleteMessageMetaTag,
  messageMetaTagsData,
  loadingMessageMeta,
  newMessageMetaKey,
  newMessageMetaValue,
  // Мета-теги топика
  showTopicMetaModal,
  closeTopicMetaModal,
  addTopicMetaTag,
  deleteTopicMetaTag,
  topicMetaTags,
  loadingTopicMeta,
  newTopicMetaKey,
  newTopicMetaValue,
  // Участники
  removeMemberFromPanel,
  showMembersUrlModal,
  showTopicsUrlModal,
  // URL модалка
  showUrlModal,
  urlModalTitle,
  urlModalUrl,
  urlCopyButtonText,
  closeUrlModal,
  copyUrlToClipboard,
} = pageData;

// Инициализация
onMounted(() => {
  // loadUsers проверяет apiKey внутри себя
  loadUsers();
});
</script>

<style scoped>
.user-dialogs-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.container {
  display: flex;
  flex: 1;
  gap: 1px;
  background: #ddd;
  overflow: hidden;
}

.users-panel {
  width: 13%;
  min-width: 410px;
  overflow: hidden;
  border-right: 1px solid #edeff3;
}

.dialogs-panel {
  width: 33%;
  min-width: 350px;
}

.messages-panel {
  width: 57%;
  min-width: 350px;
}

.panel {
  background: white;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600;
  color: #495057;
  font-size: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

/* Уменьшаем padding для таблицы пользователей, чтобы колонки были уже */
.users-panel table th,
.users-panel table td {
  padding: 4px 8px;
}

th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
}

th:hover {
  background: #e9ecef;
}

tr:hover {
  background: #f8f9fa;
}

.user-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.user-id {
  font-size: 12px;
  color: #6c757d;
}

.dialog-row {
  cursor: pointer;
}

.unread-badge {
  background: #dc3545;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
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

.info-button {
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid #7c8ff0;
  background: #7c8ff0;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  max-height: 25px;
  margin-bottom: 1px;
}

.info-button:hover {
  background: #6d7ee0;
  border-color: #6d7ee0;
}

.action-button {
  padding: 4px 5px;
  font-size: 11px;
  border: 1px solid transparent;
  background: #f8f9fa;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  margin-right: 1px;
}

.action-button.messages-button {
  background: #9f7aea;
  color: white;
  border-color: #9f7aea;
}

.action-button.messages-button:hover {
  background: #8b6ce8;
  border-color: #8b6ce8;
}

.filter-form {
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.form-section {
  margin-bottom: 12px;
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
}

.form-section select:focus,
.form-section input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-clear input {
  padding-right: 30px;
}

.clear-field {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 14px;
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
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.form-actions button:hover {
  background: #e9ecef;
}

.btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.btn-primary:hover {
  background: #5a6fd8 !important;
}

.form-actions .btn-primary {
  background: #667eea !important;
  color: white !important;
  border: none !important;
}

.form-actions .btn-primary:hover {
  background: #5a6fd8 !important;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
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

.view-url-btn {
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

.view-url-btn:hover {
  background: #5a6fd8;
}

/* Модальные окна */
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  background-color: #fefefe;
  margin: 3% auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  background: #f8f9fa;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.modal-form-container {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.modal-form-left {
  flex: 1;
  min-width: 0;
}

.modal-form-right {
  flex: 1;
  min-width: 0;
  position: sticky;
  top: 0;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.json-content {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  margin: 0;
  display: block;
}

.payload-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
}

.payload-json {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: white;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-group select,
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.remove-meta-btn {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.remove-meta-btn:hover {
  background: #c82333;
}

.add-meta-btn {
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 10px;
}

.add-meta-btn:hover {
  background: #218838;
}

.btn-success {
  background: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-success:hover {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 4px 5px;
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
}

.reaction-item-btn {
  font-size: 24px;
  padding: 8px 16px;
  border: 2px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.reaction-item-btn.active {
  background: #4fc3f7;
  border-color: #4fc3f7;
  color: white;
  transform: scale(1.1);
}

.reaction-item-btn:hover {
  background: #e9ecef;
}

.reaction-item-btn.active:hover {
  background: #3db3e7;
}

.actions-column {
  padding: 0;
  font-size: 0;
}

.view-column {
  white-space: nowrap;
}

.action-button.topics-button {
  background: #f0f0f0;
  color: #495057;
  border: 1px solid #dee2e6;
}

.action-button.topics-button:hover {
  background: #ffc107;
  color: white;
  border-color: #ffc107;
}

.action-button.members-button {
  background: #63b3ed;
  color: white;
  border-color: #63b3ed;
}

.action-button.members-button:hover {
  background: #4fa3dd;
  border-color: #4fa3dd;
}

.action-button.reactions-button {
  background: #f6ad55;
  color: white;
  border-color: #f6ad55;
}

.action-button.reactions-button:hover {
  background: #f59e42;
  border-color: #f59e42;
}

.action-button.events-button {
  background: #9f7aea;
  color: white;
  border-color: #9f7aea;
}

.action-button.events-button:hover {
  background: #8b6ce8;
  border-color: #8b6ce8;
}

.action-button.status-matrix-button {
  background: #48bb78;
  color: white;
  border-color: #48bb78;
}

.action-button.status-matrix-button:hover {
  background: #38a169;
  border-color: #38a169;
}

.action-button.statuses-button {
  background: #4299e1;
  color: white;
  border-color: #4299e1;
}

.action-button.statuses-button:hover {
  background: #3182ce;
  border-color: #3182ce;
}

.action-button.set-status-button {
  background: #ed8936;
  color: white;
  border-color: #ed8936;
}

.action-button.set-status-button:hover {
  background: #dd6b20;
  border-color: #dd6b20;
}

.width-60 {
  width: 60% !important;
  max-width: 800px;
}

.modal-title-left {
  flex: 1;
}

.modal-title-right {
  flex: 1;
  padding-left: 46px;
}

.meta-list {
  margin-bottom: 20px;
}

.meta-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.meta-section h3 {
  margin-bottom: 15px;
  font-size: 16px;
  color: #495057;
}

.member-meta-empty {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  font-style: italic;
}

.event-row-selected {
  background-color: #e3f2fd !important;
}

.action-button.updates-button {
  background: #48bb78;
  color: white;
  border-color: #48bb78;
}

.action-button.updates-button:hover {
  background: #38a169;
  border-color: #38a169;
}

.status-action-btn:hover {
  opacity: 0.9;
  transform: scale(1.05);
}

.member-meta-editor {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  background: #f8f9fa;
  max-height: 260px;
  overflow-y: auto;
}

.member-meta-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.member-meta-row input {
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.member-meta-row .member-meta-key {
  flex: 0 0 180px;
  background: white;
}

.member-meta-row .member-meta-key[readonly] {
  background: #e9ecef;
  cursor: not-allowed;
}

.member-meta-row .member-meta-value {
  flex: 1;
}

.meta-editor-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.meta-editor-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.meta-editor-actions button:hover {
  background: #e9ecef;
}

.meta-editor-actions button.btn-add-tag {
  background: #68d391;
  color: white;
}

.meta-editor-actions button.btn-add-tag:hover {
  background: #5abf7d;
}

.status-message {
  margin-top: 12px;
  font-size: 12px;
}

.status-success {
  color: #28a745;
}

.status-error {
  color: #dc3545;
}

.meta-key-input,
.meta-value-input,
.topic-meta-key-input,
.topic-meta-value-input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-add-meta-tag {
  padding: 6px 12px;
  font-size: 12px;
  line-height: 1;
  height: auto;
  border-radius: 4px;
}

.btn-add-meta-tag:hover {
  background: #218838;
}

/* Стили для вкладок */
.tabs-container {
  display: flex;
  border-bottom: 2px solid #e9ecef;
  background: #f8f9fa;
  min-height: 59px;
}

.tab-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #495057;
  background: #e9ecef;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: white;
  font-weight: 600;
}
</style>
