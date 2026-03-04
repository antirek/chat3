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
          @show-mark-all-read="showMarkAllReadModal"
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
          <div class="tabs-container">
            <button
              type="button"
              class="tab-button"
              :class="{ active: activePackTab === 'dialogs' }"
              @click="switchPackTab('dialogs')"
            >
              📋 Диалоги
            </button>
            <button
              type="button"
              class="tab-button"
              :class="{ active: activePackTab === 'messages' }"
              @click="switchPackTab('messages')"
            >
              📝 Сообщения
            </button>
            <button
              type="button"
              class="tab-button"
              :class="{ active: activePackTab === 'users' }"
              @click="switchPackTab('users')"
            >
              👥 Участники
            </button>
          </div>

          <!-- Единый заголовок: заголовок таба + кнопка URL -->
          <div class="right-panel-header">
            <span class="right-panel-title">{{ rightPanelTitle }}</span>
            <BaseButton
              variant="url"
              :title="'URL: ' + getPackTabUrl(activePackTab)"
              @click="showUrlWithUrl(getPackTabUrl(activePackTab))"
            >
              🔗 URL
            </BaseButton>
          </div>

          <!-- Таб Диалоги: фильтр по meta / dialogId, пагинация, таблица -->
          <PackTabTextFilterPanel
            v-show="activePackTab === 'dialogs'"
            input-id="pack-dialogs-filter"
            label="Фильтр диалогов"
            :filter-value="packDialogsFilterValue"
            :examples="packDialogsFilterExamples"
            @update:filter-value="setPackDialogsFilterValue"
            @clear="clearPackDialogsFilter"
            @apply="applyPackDialogsFilter"
          />
          <PacksPagination
            v-show="activePackTab === 'dialogs' && packDialogsTotal > 0"
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
          <div v-show="activePackTab === 'dialogs'" class="panel-content">
            <PackDialogsTable
              :dialogs="packDialogs"
              :loading="packDialogsLoading"
              :error="packDialogsError"
              @show-dialog-info="showDialogInfoModal"
            />
          </div>

          <div v-show="activePackTab === 'messages'" class="right-panel-header">
            <span class="right-panel-title">Сообщения пака</span>
          </div>
          <div v-show="activePackTab === 'messages'" class="messages-toolbar">
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
          <div v-show="activePackTab === 'messages'" v-if="packMessagesError" class="messages-error">{{ packMessagesError }}</div>
          <div v-show="activePackTab === 'messages'" class="panel-content">
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
          </div>

          <div v-show="activePackTab === 'users'" class="right-panel-header">
            <span class="right-panel-title">Участники пака</span>
            <BaseButton
              size="small"
              variant="secondary"
              :disabled="packUsersLoading"
              @click="loadPackUsers"
            >
              Обновить
            </BaseButton>
          </div>
          <div v-show="activePackTab === 'users'" class="panel-content">
            <PackUsersTable
              :users="packUsers"
              :loading="packUsersLoading"
              :error="packUsersError"
            />
          </div>
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

    <MarkPackAllReadModal
      :is-open="showMarkAllReadModalFlag"
      :pack-id="markAllReadPackId"
      :submitting="markAllReadSubmitting"
      :submit-error="markAllReadError"
      @close="closeMarkAllReadModal"
      @submit="markPackAllReadForAllUsers"
    />

    <MetaModal
      :is-open="showMetaModalFlag"
      :title="'🏷️ Meta теги пака'"
      :loading="false"
      :meta-tags="metaTags"
      @close="closeMetaModal"
      @add-tag="addMetaTag"
      @delete-tag="deleteMetaTag"
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
import { ref, watch, computed } from 'vue';
import { BasePanel, BaseButton } from '@/shared/ui';
import { usePacksPage } from '../model';
import { PackFilterPanel, PackTabTextFilterPanel, packDialogsFilterExamples } from './filters';
import { MessageFilterPanel } from '@/pages/dialogs-messages/ui/filters';
import { PackTable, PackDialogsTable, PackMessagesTable, PackUsersTable } from './tables';
import { PackInfoModal, PackUrlModal, CreatePackModal, AddDialogToPackModal, MarkPackAllReadModal, DialogInfoModal } from './modals';
import { PacksPagination } from './pagination';
import { ExtendedPagination } from '@/pages/dialogs-messages/ui/pagination';
import { MetaModal } from '@/widgets/meta-modal';

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
  packMessagesFilterValue,
  selectedMessageFilterExample,
  loadInitialPackMessages,
  loadMorePackMessages,
  changePackMessagesLimit,
  resetPackMessages,
  applyPackMessagesFilter,
  clearPackMessagesFilter,
  packUsers,
  packUsersLoading,
  packUsersError,
  packUsersFilterValue,
  packUsersPage,
  packUsersLimit,
  packUsersTotal,
  packUsersTotalPages,
  packUsersPaginationStart,
  packUsersPaginationEnd,
  packUsersPaginated,
  loadPackUsers,
  goToPackUsersPage,
  changePackUsersLimit,
  selectPack,
  loadPackDialogs,
  goToPackDialogsPage,
  changePackDialogsLimit,
  packDialogsFilterValue,
  applyPackDialogsFilter,
  clearPackDialogsFilter,
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
  showMarkAllReadModal,
  showMarkAllReadModalFlag,
  markAllReadPackId,
  markAllReadSubmitting,
  markAllReadError,
  closeMarkAllReadModal,
  markPackAllReadForAllUsers,
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
  showUrlWithUrl,
  getPackTabUrl,
  closeUrlModal,
  copyUrlToClipboard,
} = usePacksPage();

const activePackTab = ref<'dialogs' | 'messages' | 'users'>('dialogs');

const rightPanelTitle = computed(() => {
  if (activePackTab.value === 'dialogs') return 'Диалоги пака';
  if (activePackTab.value === 'messages') return 'Сообщения пака';
  if (activePackTab.value === 'users') return 'Участники пака';
  return '';
});

function setPackDialogsFilterValue(v: string) {
  packDialogsFilterValue.value = v;
}
function setPackUsersFilterValue(v: string) {
  packUsersFilterValue.value = v;
}
function clearPackUsersFilterValue() {
  packUsersFilterValue.value = '';
}

watch(selectedPackId, (packId) => {
  activePackTab.value = 'dialogs';
  if (!packId) {
    resetPackMessages();
  }
});

function switchPackTab(tab: 'dialogs' | 'messages' | 'users') {
  activePackTab.value = tab;
  if (tab === 'messages' && !packMessagesLoading.value && packMessages.value.length === 0) {
    loadInitialPackMessages();
  }
  if (tab === 'users') {
    loadPackUsers();
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
.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
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
