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

      <!-- Сообщения -->
      <BasePanel width="50%" min-width="350px">
        <template #header-left>
          <span>📝 Сообщения</span>
        </template>
        <template #header-right>
          <BaseButton
            variant="url"
            @click="showCurrentMessageUrl"
            title="Показать URL запроса"
            v-show="currentDialogId"
          >
            🔗 URL
          </BaseButton>
        </template>

        <MessageFilterPanel
          v-show="currentDialogId"
          v-model:filter-value="messageFilterValue"
          v-model:selected-example="selectedMessageFilterExample"
          @clear="clearMessageFilter"
          @apply="applyMessageFilter"
        />

        <ExtendedPagination
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
      </BasePanel>
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
import { BasePanel, BaseButton } from '@/shared/ui';
import { useDialogsMessagesPage } from '../model';
import { DialogTable, MessagesTableSimple } from './tables';
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
</style>
