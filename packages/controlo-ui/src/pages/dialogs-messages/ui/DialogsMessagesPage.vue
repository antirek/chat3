<template>
  <div class="dialogs-messages-page">
    <div class="container">
      <!-- Диалоги -->
      <BasePanel width="50%" min-width="350px">
        <template #header-left>
          <span>💬 Диалоги</span>
          <BaseButton variant="success" @click="showAddDialogModal" title="Создать диалог">➕ Добавить</BaseButton>
        </template>
        <template #header-right>
          <BaseButton variant="url" @click="showCurrentUrl" title="Показать URL запроса">🔗 URL</BaseButton>
        </template>

        <DialogFilterPanel
          v-model:filter-value="filterValue"
          v-model:selected-filter-example="selectedFilterExample"
          v-model:sort-value="sortValue"
          v-model:selected-sort-example="selectedSortExample"
          :applying="applying"
          :button-text="applyButtonText"
          @apply="applyCombined"
        />

        <ExtendedPagination
          :show="showDialogsPagination"
          :current-page="currentPage"
          :current-page-input="currentPageInput"
          :total-pages="totalPages"
          :total="totalDialogs"
          :pagination-start="dialogPaginationStart"
          :pagination-end="dialogPaginationEnd"
          :limit="currentDialogLimit"
          @first="goToDialogsFirstPage"
          @prev="goToDialogsPreviousPage"
          @next="goToDialogsNextPage"
          @last="goToDialogsLastPage"
          @go-to-page="goToDialogsPage"
          @change-limit="changeDialogLimit"
        />

        <DialogTable
          :dialogs="dialogs"
          :loading="loadingDialogs"
          :error="dialogsError"
          :current-dialog-id="currentDialogId"
          :current-sort="currentSort"
          :get-sort-indicator="getDialogSortIndicator"
          :format-timestamp="formatTimestamp"
          :format-members="formatMembers"
          @toggle-sort="toggleSort"
          @select-dialog="selectDialog"
          @show-info="showDialogInfo"
        />
      </BasePanel>

      <!-- Сообщения / Участники / Топики -->
      <BasePanel class="right-panel" width="50%" min-width="350px">
        <div v-if="currentDialogId" class="tabs-container">
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'messages' }"
            @click="selectMessagesTab"
          >
            📝 Сообщения
          </button>
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'members' }"
            @click="selectMembersTab"
          >
            👥 Участники
          </button>
          <button
            class="tab-button"
            :class="{ active: currentViewMode === 'topics' }"
            @click="selectTopicsTab"
          >
            📌 Топики
          </button>
        </div>

        <div v-if="currentDialogId" class="right-panel-header">
          <span class="right-panel-title">{{ rightPanelTitle }}</span>
          <BaseButton
            variant="url"
            @click="showCurrentTabUrl"
            title="Показать URL запроса"
          >
            🔗 URL
          </BaseButton>
        </div>

        <MessageFilterPanel
          v-show="currentDialogId && currentViewMode === 'messages'"
          v-model:filter-value="messageFilterValue"
          v-model:selected-example="selectedMessageFilterExample"
          @clear="clearMessageFilter"
          @apply="applyMessageFilter"
        />

        <ExtendedPagination
          v-show="currentViewMode === 'messages' && showMessagesPagination"
          :show="showMessagesPagination"
          :current-page="currentMessagePage"
          :current-page-input="currentMessagePageInput"
          :total-pages="totalMessagePages"
          :total="totalMessages"
          :pagination-start="messagePaginationStart"
          :pagination-end="messagePaginationEnd"
          :limit="currentMessageLimit"
          @first="goToMessagesFirstPage"
          @prev="goToMessagesPreviousPage"
          @next="goToMessagesNextPage"
          @last="goToMessagesLastPage"
          @go-to-page="goToMessagesPage"
          @change-limit="changeMessageLimit"
        />

        <div v-show="currentViewMode === 'messages'" class="panel-content">
          <MessagesTableSimple
            :messages="messages"
            :loading="loadingMessages"
            :error="messagesError"
            :current-dialog-id="currentDialogId"
            :current-sort="currentMessageSort"
            :get-sort-indicator="getMessageSortIndicator"
            :toggle-sort="toggleMessageSort"
            :format-timestamp="formatTimestamp"
            :show-info="showMessageInfo"
          />
        </div>

        <ExtendedPagination
          v-show="currentViewMode === 'members' && showMembersPagination"
          :show="showMembersPagination"
          :current-page="currentMemberPage"
          :current-page-input="currentMemberPageInput"
          :total-pages="totalMemberPages"
          :total="totalMembers"
          :pagination-start="memberPaginationStart"
          :pagination-end="memberPaginationEnd"
          :limit="currentMemberLimit"
          @first="goToMembersFirstPage"
          @prev="goToMembersPreviousPage"
          @next="goToMembersNextPage"
          @last="goToMembersLastPage"
          @go-to-page="goToMembersPage"
          @change-limit="changeMemberLimit"
        />

        <div v-show="currentViewMode === 'members'" class="panel-content">
          <MembersTableSimple
            :members="members"
            :loading="loadingMembers"
            :error="membersError"
            :current-dialog-id="currentDialogId"
          />
        </div>

        <ExtendedPagination
          v-show="currentViewMode === 'topics' && showTopicsPagination"
          :show="showTopicsPagination"
          :current-page="currentTopicsPage"
          :current-page-input="currentTopicsPageInput"
          :total-pages="totalTopicsPages"
          :total="totalTopics"
          :pagination-start="topicsPaginationStart"
          :pagination-end="topicsPaginationEnd"
          :limit="currentTopicsLimit"
          @first="goToTopicsFirstPage"
          @prev="goToTopicsPreviousPage"
          @next="goToTopicsNextPage"
          @last="goToTopicsLastPage"
          @go-to-page="goToTopicsPage"
          @change-limit="changeTopicsLimit"
        />

        <div v-show="currentViewMode === 'topics'" class="panel-content">
          <TopicsTableSimple
            :topics="topics"
            :loading="loadingTopics"
            :error="topicsError"
            :current-dialog-id="currentDialogId"
          />
        </div>
      </BasePanel>
    </div>

    <DialogInfoModal
      :is-open="showInfoModalFlag"
      :title="modalTitle"
      :url="modalUrl"
      :json-content="modalJsonContent"
      :other-content="modalOtherContent"
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
import { BasePanel, BaseButton } from '@/shared/ui';
import { useDialogsMessagesPage } from '../model';
import { DialogTable, MessagesTableSimple, MembersTableSimple, TopicsTableSimple } from './tables';
import { DialogInfoModal, CreateDialogModal, UrlModal } from './modals';
import { ExtendedPagination } from './pagination';
import { DialogFilterPanel, MessageFilterPanel } from './filters';

const {
  // Диалоги
  dialogs,
  loadingDialogs,
  dialogsError,
  currentPage,
  currentPageInput,
  currentDialogLimit,
  totalPages,
  totalDialogs,
  dialogPaginationStart,
  dialogPaginationEnd,
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
  currentMessagePageInput,
  currentMessageLimit,
  totalMessagePages,
  totalMessages,
  messagePaginationStart,
  messagePaginationEnd,
  visibleMessagePages,
  currentMessageSort,
  messageFilterValue,
  selectedMessageFilterExample,
  showMessagesPagination,
  // Таб правой панели
  currentViewMode,
  selectMessagesTab,
  selectMembersTab,
  selectTopicsTab,
  // Участники
  members,
  loadingMembers,
  membersError,
  showMembersPagination,
  currentMemberPage,
  currentMemberPageInput,
  currentMemberLimit,
  totalMemberPages,
  totalMembers,
  memberPaginationStart,
  memberPaginationEnd,
  goToMembersFirstPage,
  goToMembersPreviousPage,
  goToMembersNextPage,
  goToMembersLastPage,
  goToMembersPage,
  changeMemberLimit,
  // Топики
  topics,
  loadingTopics,
  topicsError,
  showTopicsPagination,
  currentTopicsPage,
  currentTopicsPageInput,
  currentTopicsLimit,
  totalTopicsPages,
  totalTopics,
  topicsPaginationStart,
  topicsPaginationEnd,
  goToTopicsFirstPage,
  goToTopicsPreviousPage,
  goToTopicsNextPage,
  goToTopicsLastPage,
  goToTopicsPage,
  changeTopicsLimit,
  // Модальные окна
  showInfoModalFlag,
  showCreateDialogModalFlag,
  modalTitle,
  modalUrl,
  modalJsonContent,
  modalOtherContent,
  // Создание диалога
  usersForDialog,
  loadingUsers,
  usersError,
  usersLoaded,
  selectedMembers,
  // Функции
  applyCombined,
  // Dialogs Pagination Functions
  goToDialogsFirstPage,
  goToDialogsPreviousPage,
  goToDialogsNextPage,
  goToDialogsLastPage,
  goToDialogsPage,
  changeDialogLimit,
    changePage,
    formatTimestamp,
    formatMembers,
    selectDialog,
    // Messages Pagination Functions
    goToMessagesFirstPage,
    goToMessagesPreviousPage,
    goToMessagesNextPage,
    goToMessagesLastPage,
    goToMessagesPage,
    changeMessageLimit,
    changeMessagePage,
    formatMessageTime,
  toggleSort,
  getDialogSortIndicator,
  toggleMessageSort,
  getMessageSortIndicator,
  applyMessageFilter,
  clearMessageFilter,
  showCurrentMessageUrl,
  showCurrentTabUrl,
  rightPanelTitle,
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
  overflow: hidden;
  min-height: 0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

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

.right-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  min-height: 48px;
}

.right-panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #495057;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
}
</style>
