<template>
  <div class="messages-page">
    <BasePanel>
      <template #header-left>
        <span>📝 Сообщения</span>
      </template>
      <template #header-right>
        <BaseButton variant="url" @click="showUrlModal">🔗 URL</BaseButton>
      </template>
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
    </BasePanel>

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
import { BasePanel, BaseButton } from '@/shared/ui';
import { useMessagesPage } from '../model';
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

</style>
