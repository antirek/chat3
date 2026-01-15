<template>
  <div class="messages-page">
    <div class="page-header">
      <div class="page-header-left">
        <h1>📝 Сообщения</h1>
      </div>
      <div class="page-header-right">
        <button class="btn-primary btn-small" @click="showUrlModal">🔗 URL</button>
      </div>
    </div>

    <div class="page-container">
      <MessageFilterPanel
        :filter-input="filterInput"
        :selected-filter-example="selectedFilterExample"
        @update:filter-input="filterInput = $event"
        @update:selected-filter-example="selectedFilterExample = $event"
        @select-example="selectMessageFilterExample"
        @clear="clearMessageFilter"
        @apply="applyMessageFilter"
      />

      <MessagesPagination
        :current-page="currentPage"
        :current-page-input="currentPageInput"
        :total-pages="totalPages"
        :total="totalMessages"
        :current-limit="currentLimit"
        @go-to-page="goToPage"
        @change-limit="changeLimit"
      />

      <MessageTable
        :messages="messages"
        :loading="loading"
        :error="error"
        :get-sort-indicator="getSortIndicator"
        :toggle-sort="toggleSort"
        :format-timestamp="formatTimestamp"
        :get-dialog-name="getDialogName"
        :show-info="showInfoModal"
        :show-meta="showMetaModal"
      />
    </div>

    <MessageInfoModal
      :is-open="showInfoModalFlag"
      :url="infoUrl"
      :content="jsonViewerContent"
      :copy-button-text="copyJsonButtonText"
      @close="closeInfoModal"
      @copy="copyJsonToClipboard"
    />

    <MessageMetaModal
      :is-open="showMetaModalFlag"
      :meta-tags="metaTags"
      :new-meta-key="newMetaKeyForEdit"
      :new-meta-value="newMetaValueForEdit"
      @close="closeMetaModal"
      @add-meta-tag="addMetaTag"
      @delete-meta-tag="deleteMetaTag"
      @update:newMetaKey="newMetaKeyForEdit = $event"
      @update:newMetaValue="newMetaValueForEdit = $event"
    />

    <MessageUrlModal
      :is-open="showUrlModalFlag"
      :generated-url="generatedUrl"
      :full-url="fullUrl"
      :current-page="currentPage"
      :current-limit="currentLimit"
      :current-filter="currentFilter"
      :current-sort="currentSort"
      :copy-button-text="copyUrlButtonText"
      @close="closeUrlModal"
      @copy="copyUrlToClipboard"
    />
  </div>
</template>

<script setup lang="ts">
import { useMessagesPage } from '../model/useMessagesPage';
import { MessageFilterPanel } from './filters';
import { MessageTable } from './tables';
import { MessageInfoModal, MessageMetaModal, MessageUrlModal } from './modals';
import { MessagesPagination } from './pagination';

const {
  // State
  messages,
  loading,
  error,
  // Pagination
  currentPage,
  currentLimit,
  totalPages,
  totalMessages,
  visiblePages,
  // Filter
  filterInput,
  selectedFilterExample,
  currentFilter,
  // Sort
  currentSort,
  // Modals
  showInfoModalFlag,
  showMetaModalFlag,
  showUrlModalFlag,
  // Meta теги
  metaTags,
  newMetaKeyForEdit,
  newMetaValueForEdit,
  // Info modal
  infoUrl,
  jsonViewerContent,
  copyJsonButtonText,
  // URL modal
  generatedUrl,
  fullUrl,
  copyUrlButtonText,
  // Functions
  goToPreviousPage,
  goToNextPage,
  goToPage,
  changeLimit,
  currentPageInput,
  getSortIndicator,
  toggleSort,
  getDialogName,
  formatTimestamp,
  showInfoModal,
  closeInfoModal,
  copyJsonToClipboard,
  showMetaModal,
  closeMetaModal,
  addMetaTag,
  deleteMetaTag,
  selectMessageFilterExample,
  clearMessageFilter,
  applyMessageFilter,
  showUrlModal,
  closeUrlModal,
  copyUrlToClipboard,
} = useMessagesPage();
</script>

<style scoped>
.messages-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
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

.page-header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.page-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-header h1 {
  font-size: 16px;
  color: #495057;
  font-weight: 600;
}

.page-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.btn-small {
  padding: 4px 10px;
  font-size: 11px;
  margin-right: 5px;
}
</style>
