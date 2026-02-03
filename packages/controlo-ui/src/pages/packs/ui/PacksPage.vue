<template>
  <div class="packs-page">
    <div class="container">
      <BasePanel width="50%" min-width="350px">
        <template #header-left>
          <span>📦 Паки</span>
          <BaseButton variant="success" @click="showCreateModal">➕ Создать пак</BaseButton>
        </template>
        <template #header-right>
          <BaseButton variant="url" @click="showUrlModal">🔗 URL</BaseButton>
        </template>

        <PackFilterPanel
          :filter-input="filterInput"
          :selected-filter-example="selectedFilterExample"
          @update:filter-input="filterInput = $event"
          @update:selected-filter-example="selectedFilterExample = $event"
          @clear="clearPackFilter"
          @apply="applyPackFilter"
        />

        <PacksPagination
          :current-page="currentPage"
          :current-page-input="currentPageInput"
          :total-pages="totalPages"
          :total="totalPacks"
          :pagination-start="paginationStart"
          :pagination-end="paginationEnd"
          :current-limit="currentLimit"
          @first="goToFirstPage"
          @prev="goToPreviousPage"
          @next="goToNextPage"
          @last="goToLastPage"
          @go-to-page="goToPage"
          @change-limit="changeLimit"
        />

        <PackTable
          :packs="packs"
          :loading="loading"
          :error="error"
          :selected-pack-id="selectedPackId"
          :get-sort-indicator="getSortIndicator"
          :format-timestamp="formatTimestamp"
          @toggle-sort="toggleSort"
          @select-pack="selectPack"
          @show-info="showInfoModal"
          @show-add-dialog="showAddDialogModal"
          @show-meta="showMetaModal"
          @delete="deletePack"
        />
      </BasePanel>

      <BasePanel class="right-panel" width="50%" min-width="350px">
        <template v-if="selectedPackId" #header-left>
          <span>💬 Диалоги пака {{ selectedPackId }}</span>
        </template>
        <template v-if="selectedPackId" #header-right>
          <BaseButton variant="success" size="small" @click="showAddDialogModal(selectedPackId)">➕ Диалог</BaseButton>
        </template>

        <div v-if="!selectedPackId" class="right-panel-placeholder">
          Выберите пак в списке слева (клик по Pack ID или по числу в колонке «Диалоги»).
        </div>

        <template v-else>
          <PacksPagination
            v-if="packDialogsTotal > 0"
            :current-page="packDialogsPage"
            :current-page-input="packDialogsPage"
            :total-pages="packDialogsTotalPages"
            :total="packDialogsTotal"
            :pagination-start="packDialogsPaginationStart"
            :pagination-end="packDialogsPaginationEnd"
            :current-limit="packDialogsLimit"
            @first="goToPackDialogsPage(1)"
            @prev="goToPackDialogsPage(Math.max(1, packDialogsPage - 1))"
            @next="goToPackDialogsPage(Math.min(packDialogsTotalPages, packDialogsPage + 1))"
            @last="goToPackDialogsPage(packDialogsTotalPages)"
            @go-to-page="goToPackDialogsPage"
            @change-limit="changePackDialogsLimit"
          />
          <PackDialogsTable
            :dialogs="packDialogs"
            :loading="packDialogsLoading"
            :error="packDialogsError"
            @show-dialog-info="showDialogInfoModal"
          />
        </template>
      </BasePanel>
    </div>

    <CreatePackModal
      :is-open="showCreateModalFlag"
      @close="closeCreateModal"
      @submit="createPack"
    />

    <AddDialogToPackModal
      :is-open="showAddDialogModalFlag"
      :pack-id="addDialogPackId"
      :dialog-id="addDialogDialogId"
      @close="closeAddDialogModal"
      @submit="addDialogToPack"
      @update:dialog-id="onUpdateAddDialogDialogId"
    />

    <PackMetaModal
      :is-open="showMetaModalFlag"
      :meta-tags="metaTags"
      :new-meta-key="newMetaKeyForEdit"
      :new-meta-value="newMetaValueForEdit"
      @close="closeMetaModal"
      @add-meta-tag="addMetaTag"
      @delete-meta-tag="deleteMetaTag"
      @update:new-meta-key="onUpdateNewMetaKey"
      @update:new-meta-value="onUpdateNewMetaValue"
    />

    <PackInfoModal
      :is-open="showInfoModalFlag"
      :url="infoUrl"
      :content="jsonViewerContent"
      :copy-button-text="copyJsonButtonText"
      @close="closeInfoModal"
      @copy="(button) => copyJsonToClipboard(button)"
    />

    <PackUrlModal
      :is-open="showUrlModalFlag"
      :url="generatedUrl"
      :copy-button-text="copyUrlButtonText"
      @close="closeUrlModal"
      @copy="copyUrlToClipboard"
    />

    <DialogInfoModal
      :is-open="showDialogInfoModalFlag"
      :url="dialogInfoUrl"
      :content="dialogInfoJsonContent"
      :copy-button-text="dialogInfoCopyButtonText"
      @close="closeDialogInfoModal"
      @copy="(button) => copyDialogJsonToClipboard(button)"
    />
  </div>
</template>

<script setup lang="ts">
import { BasePanel, BaseButton } from '@/shared/ui';
import { usePacksPage } from '../model';
import { PackFilterPanel } from './filters';
import { PackTable, PackDialogsTable } from './tables';
import { PackInfoModal, PackMetaModal, PackUrlModal, CreatePackModal, AddDialogToPackModal, DialogInfoModal } from './modals';
import { PacksPagination } from './pagination';

const {
  packs,
  loading,
  error,
  selectedPackId,
  packDialogs,
  packDialogsLoading,
  packDialogsError,
  packDialogsPage,
  packDialogsLimit,
  packDialogsTotal,
  packDialogsTotalPages,
  packDialogsPaginationStart,
  packDialogsPaginationEnd,
  selectPack,
  goToPackDialogsPage,
  changePackDialogsLimit,
  currentPage,
  currentLimit,
  totalPages,
  totalPacks,
  filterInput,
  selectedFilterExample,
  showCreateModalFlag,
  showAddDialogModalFlag,
  addDialogPackId,
  addDialogDialogId,
  showMetaModalFlag,
  showInfoModalFlag,
  showDialogInfoModalFlag,
  showUrlModalFlag,
  dialogInfoUrl,
  dialogInfoJsonContent,
  dialogInfoCopyButtonText,
  metaTags,
  newMetaKeyForEdit,
  newMetaValueForEdit,
  infoUrl,
  jsonViewerContent,
  copyJsonButtonText,
  generatedUrl,
  copyUrlButtonText,
  currentPageInput,
  paginationStart,
  paginationEnd,
  loadPacks,
  goToFirstPage,
  goToPreviousPage,
  goToNextPage,
  goToLastPage,
  goToPage,
  changeLimit,
  getSortIndicator,
  toggleSort,
  formatTimestamp,
  showCreateModal,
  closeCreateModal,
  createPack,
  showAddDialogModal,
  closeAddDialogModal,
  addDialogToPack,
  onUpdateAddDialogDialogId,
  showMetaModal,
  closeMetaModal,
  addMetaTag,
  deleteMetaTag,
  showInfoModal,
  closeInfoModal,
  copyJsonToClipboard,
  showDialogInfoModal,
  closeDialogInfoModal,
  copyDialogJsonToClipboard,
  deletePack,
  selectPackFilterExample,
  clearPackFilter,
  applyPackFilter,
  showUrlModal,
  closeUrlModal,
  copyUrlToClipboard,
} = usePacksPage();

function onUpdateNewMetaKey(v: string) {
  newMetaKeyForEdit.value = v;
}
function onUpdateNewMetaValue(v: string) {
  newMetaValueForEdit.value = v;
}
</script>

<style scoped>
.packs-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.container {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;
}
.container :deep(.base-panel) {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.right-panel {
  border-left: 1px solid #e9ecef;
}
.right-panel-placeholder {
  padding: 24px;
  color: #6c757d;
  font-size: 14px;
  text-align: center;
}
</style>
