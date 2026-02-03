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
          <span>📂 Пак {{ selectedPackId }}</span>
        </template>
        <template v-if="selectedPackId" #header-right>
          <BaseButton variant="success" size="small" @click="showAddDialogModal(selectedPackId)">➕ Диалог</BaseButton>
        </template>

        <div v-if="!selectedPackId" class="right-panel-placeholder">
          Выберите пак в списке слева (клик по Pack ID или по числу в колонке «Диалоги»).
        </div>

        <template v-else>
          <div class="right-panel-tabs">
            <button
              type="button"
              class="tab-button"
              :class="{ active: activePackTab === 'dialogs' }"
              @click="switchPackTab('dialogs')"
            >
              Диалоги
            </button>
            <button
              type="button"
              class="tab-button"
              :class="{ active: activePackTab === 'messages' }"
              @click="switchPackTab('messages')"
            >
              Сообщения
            </button>
          </div>

          <template v-if="activePackTab === 'dialogs'">
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
          <template v-else>
            <div class="messages-toolbar">
              <label class="messages-limit">
                Лимит:
                <select :value="packMessagesLimit" @change="onPackMessagesLimitChange">
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
              </label>
              <BaseButton
                size="small"
                variant="secondary"
                :disabled="packMessagesLoading"
                @click="loadInitialPackMessages"
              >
                Обновить
              </BaseButton>
            </div>
            <div v-if="packMessagesError" class="messages-error">{{ packMessagesError }}</div>
            <PackMessagesTable
              :messages="packMessages"
              :loading="packMessagesLoading"
              :error="packMessagesError"
              :format-timestamp="formatTimestamp"
            />
            <div class="messages-footer">
              <BaseButton
                v-if="packMessagesHasMore"
                variant="primary"
                :disabled="packMessagesLoading"
                @click="loadMorePackMessages"
              >
                {{ packMessagesLoading ? 'Загрузка...' : 'Показать ещё' }}
              </BaseButton>
              <span v-else-if="!packMessagesLoading && packMessages.length > 0" class="messages-end">
                Больше сообщений нет.
              </span>
            </div>
          </template>
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
import { ref, watch } from 'vue';
import { BasePanel, BaseButton } from '@/shared/ui';
import { usePacksPage } from '../model';
import { PackFilterPanel } from './filters';
import { PackTable, PackDialogsTable, PackMessagesTable } from './tables';
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
  packMessages,
  packMessagesLoading,
  packMessagesError,
  packMessagesHasMore,
  packMessagesLimit,
  loadInitialPackMessages,
  loadMorePackMessages,
  changePackMessagesLimit,
  resetPackMessages,
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

const activePackTab = ref<'dialogs' | 'messages'>('dialogs');

watch(selectedPackId, (packId) => {
  activePackTab.value = 'dialogs';
  if (!packId) {
    resetPackMessages();
  }
});

function switchPackTab(tab: 'dialogs' | 'messages') {
  activePackTab.value = tab;
  if (tab === 'messages' && !packMessagesLoading.value && packMessages.value.length === 0) {
    loadInitialPackMessages();
  }
}

function onPackMessagesLimitChange(event: Event) {
  const target = event.target as HTMLSelectElement | null;
  if (!target) return;
  const value = Number(target.value);
  if (!Number.isNaN(value)) {
    changePackMessagesLimit(value);
  }
}

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
.right-panel-tabs {
  display: flex;
  gap: 8px;
  margin: 8px 0 12px;
}
.tab-button {
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #f8f9fa;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s, color 0.2s;
}
.tab-button:hover {
  background: #e9ecef;
}
.tab-button.active {
  background: #667eea;
  color: #fff;
  border-color: #667eea;
}
.messages-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 12px;
}
.messages-limit select {
  margin-left: 6px;
  padding: 2px 6px;
}
.messages-error {
  color: #dc3545;
  font-size: 13px;
  margin-bottom: 8px;
}
.messages-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.messages-end {
  font-size: 12px;
  color: #6c757d;
}
</style>
