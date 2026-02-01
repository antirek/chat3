<template>
  <div class="topics-messages-page">
    <div class="container">
      <!-- Топики -->
      <BasePanel width="50%" min-width="350px">
        <template #header-left>
          <span>📌 Топики</span>
        </template>
        <template #header-right>
          <BaseButton variant="url" @click="showCurrentUrl" title="Показать URL запроса">🔗 URL</BaseButton>
        </template>

        <TopicFilterPanel
          v-model:filter-value="filterValue"
          v-model:selected-filter-example="selectedFilterExample"
          :applying="applying"
          :button-text="applyButtonText"
          @apply="applyCombined"
        />

        <ExtendedPagination
          :show="showTopicsPagination"
          :current-page="topicsPagination.currentPage.value"
          :current-page-input="topicsPagination.currentPageInput.value"
          :total-pages="topicsPagination.totalPages.value"
          :total="topicsPagination.totalItems.value"
          :pagination-start="topicsPagination.paginationStart.value"
          :pagination-end="topicsPagination.paginationEnd.value"
          :limit="topicsPagination.currentLimit.value"
          @first="topicsPagination.goToFirstPage()"
          @prev="topicsPagination.goToPreviousPage()"
          @next="topicsPagination.goToNextPage()"
          @last="topicsPagination.goToLastPage()"
          @go-to-page="topicsPagination.goToPage"
          @change-limit="topicsPagination.changeLimit"
        />

        <TopicTable
          :topics="topics"
          :loading="loadingTopics"
          :error="topicsError"
          :selected-topic-id="selectedTopicId"
          :selected-topic-key="selectedTopicKey"
          :format-timestamp="formatTimestamp"
          @select-topic="selectTopic"
          @show-info="showTopicInfo"
          @show-meta="showTopicMeta"
        />
      </BasePanel>

      <!-- Диалог топика + Сообщения / Участники -->
      <BasePanel class="right-panel" width="50%" min-width="350px">
        <div v-if="!selectedTopicId" class="placeholder">Выберите топик</div>

        <template v-else>
          <!-- Диалог топика (во всю ширину сверху) -->
          <div class="dialog-topic-header">
            <span class="dialog-topic-label">💬 Диалог топика:</span>
            <span class="dialog-topic-id" :title="selectedDialogId">{{ selectedDialogId }}</span>
            <div class="dialog-topic-actions">
              <BaseButton variant="secondary" size="small" @click="showDialogInfoForTopic(selectedDialogId!)" title="Просмотр JSON диалога">Инфо</BaseButton>
              <BaseButton variant="secondary" size="small" @click="goToDialogsMessagesPage(selectedDialogId!)" title="Перейти к Диалоги + Сообщения с фильтром по dialogId">Переход</BaseButton>
            </div>
          </div>

          <!-- Табы Сообщения | Участники -->
          <div class="tabs-container">
            <button
              class="tab-button"
              :class="{ active: currentRightTab === 'messages' }"
              @click="selectMessagesTab"
            >
              📝 Сообщения
            </button>
            <button
              class="tab-button"
              :class="{ active: currentRightTab === 'members' }"
              @click="selectMembersTab"
            >
              👥 Участники
            </button>
          </div>

          <div v-if="currentRightTab === 'messages'" class="right-panel-header">
            <span class="right-panel-title">Сообщения топика</span>
            <BaseButton variant="url" @click="showCurrentMessageUrl" title="Показать URL запроса">🔗 URL</BaseButton>
          </div>

          <MessageFilterPanel
            v-show="currentRightTab === 'messages'"
            v-model:filter-value="messageFilterValue"
            v-model:selected-example="selectedMessageFilterExample"
            @clear="clearMessageFilter"
            @apply="applyMessageFilter"
          />

          <ExtendedPagination
            v-show="currentRightTab === 'messages' && showMessagesPagination"
            :show="showMessagesPagination"
            :current-page="messagesPagination.currentPage.value"
            :current-page-input="messagesPagination.currentPageInput.value"
            :total-pages="messagesPagination.totalPages.value"
            :total="messagesPagination.totalItems.value"
            :pagination-start="messagesPagination.paginationStart.value"
            :pagination-end="messagesPagination.paginationEnd.value"
            :limit="messagesPagination.currentLimit.value"
            @first="messagesPagination.goToFirstPage()"
            @prev="messagesPagination.goToPreviousPage()"
            @next="messagesPagination.goToNextPage()"
            @last="messagesPagination.goToLastPage()"
            @go-to-page="messagesPagination.goToPage"
            @change-limit="messagesPagination.changeLimit"
          />

          <div v-show="currentRightTab === 'messages'" class="panel-content">
            <MessagesTableSimple
              :messages="messages"
              :loading="loadingMessages"
              :error="messagesError"
              :current-dialog-id="selectedDialogId"
              :current-sort="currentMessageSort"
              :get-sort-indicator="getMessageSortIndicator"
              :toggle-sort="toggleMessageSort"
              :format-timestamp="formatTimestamp"
              :show-info="showMessageInfo"
            />
          </div>

          <ExtendedPagination
            v-show="currentRightTab === 'members' && showMembersPagination"
            :show="showMembersPagination"
            :current-page="membersPagination.currentPage.value"
            :current-page-input="membersPagination.currentPageInput.value"
            :total-pages="membersPagination.totalPages.value"
            :total="membersPagination.totalItems.value"
            :pagination-start="membersPagination.paginationStart.value"
            :pagination-end="membersPagination.paginationEnd.value"
            :limit="membersPagination.currentLimit.value"
            @first="goToMembersFirstPage"
            @prev="goToMembersPreviousPage"
            @next="goToMembersNextPage"
            @last="goToMembersLastPage"
            @go-to-page="goToMembersPage"
            @change-limit="changeMemberLimit"
          />

          <div v-show="currentRightTab === 'members'" class="panel-content">
            <MembersTableSimple
              :members="members"
              :loading="loadingMembers"
              :error="membersError"
              :current-dialog-id="selectedDialogId"
            />
          </div>
        </template>
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

    <TopicMetaModal
      :is-open="isTopicMetaModalOpen"
      :meta-tags="topicMetaTags"
      :loading="loadingTopicMeta"
      :new-key="newTopicMetaKey"
      :new-value="newTopicMetaValue"
      @close="closeTopicMetaModal"
      @delete-tag="deleteTopicMetaTag"
      @add-tag="addTopicMetaTag"
      @update:new-key="setNewTopicMetaKey"
      @update:new-value="setNewTopicMetaValue"
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
import { useTopicsMessagesPage } from '../model';
import { TopicFilterPanel } from './filters';
import { TopicTable } from './tables';
import { ExtendedPagination } from '@/pages/dialogs-messages/ui/pagination';
import { MessageFilterPanel } from '@/pages/dialogs-messages/ui/filters';
import { MessagesTableSimple, MembersTableSimple } from '@/pages/dialogs-messages/ui/tables';
import { DialogInfoModal, UrlModal } from '@/pages/dialogs-messages/ui/modals';
import { TopicMetaModal } from '@/pages/user-dialogs/ui/modals';

const {
  topics,
  loadingTopics,
  topicsError,
  filterValue,
  selectedFilterExample,
  applying,
  applyButtonText,
  showTopicsPagination,
  topicsPagination,
  loadTopics,
  applyCombined,
  toggleSort,
  getSortIndicator,
  showCurrentUrl,
  selectTopic,
  selectedTopicId,
  selectedDialogId,
  selectedTopicKey,
  currentRightTab,
  selectMessagesTab,
  selectMembersTab,
  members,
  loadingMembers,
  membersError,
  showMembersPagination,
  membersPagination,
  goToMembersPage,
  goToMembersFirstPage,
  goToMembersPreviousPage,
  goToMembersNextPage,
  goToMembersLastPage,
  changeMemberLimit,
  showTopicInfo,
  showMessageInfo,
  showDialogInfoForTopic,
  goToDialogsMessagesPage,
  showTopicMeta,
  isTopicMetaModalOpen,
  topicMetaTags,
  loadingTopicMeta,
  newTopicMetaKey,
  newTopicMetaValue,
  closeTopicMetaModal,
  addTopicMetaTag,
  deleteTopicMetaTag,
  setNewTopicMetaKey,
  setNewTopicMetaValue,
  messages,
  loadingMessages,
  messagesError,
  messageFilterValue,
  selectedMessageFilterExample,
  showMessagesPagination,
  messagesPagination,
  currentMessageSort,
  applyMessageFilter,
  clearMessageFilter,
  toggleMessageSort,
  getMessageSortIndicator,
  formatTimestamp,
  showCurrentMessageUrl,
  showInfoModalFlag,
  modalTitle,
  modalUrl,
  modalJsonContent,
  modalOtherContent,
  closeModal,
  showUrlModal,
  urlModalTitle,
  urlModalUrl,
  urlCopyButtonText,
  closeUrlModal,
  copyUrlToClipboard,
} = useTopicsMessagesPage();
</script>

<style scoped>
.topics-messages-page {
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

.dialog-topic-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: #e9ecef;
  border-bottom: 1px solid #dee2e6;
  font-size: 14px;
}

.dialog-topic-label {
  font-weight: 600;
  color: #495057;
  margin-right: 0;
}

.dialog-topic-id {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, monospace;
  color: #212529;
  word-break: break-all;
}

.dialog-topic-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.tabs-container {
  display: flex;
  border-bottom: 2px solid #e9ecef;
  background: #f8f9fa;
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
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.right-panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #495057;
}

.placeholder {
  padding: 24px;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
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
