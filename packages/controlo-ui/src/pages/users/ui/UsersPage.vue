<template>
  <div class="users-page">
    <BasePanel>
      <template #header-left>
        <span>👤 Пользователи</span>
        <button class="btn-success btn-small" @click="showCreateModal">➕ Создать пользователя</button>
      </template>
      <template #header-right>
        <button class="btn-primary btn-small" @click="showUrlModal">URL</button>
      </template>
      <UserFilterPanel
        :filter-input="filterInput"
        :selected-filter-example="selectedFilterExample"
        @update:filter-input="filterInput = $event"
        @update:selected-filter-example="selectedFilterExample = $event"
        @select-example="selectUserFilterExample"
        @clear="clearUserFilter"
        @apply="applyUserFilter"
      />

      <UsersPagination
        :current-page="currentPage"
        :current-page-input="currentPageInput"
        :total-pages="totalPages"
        :total="totalUsers"
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

      <UserTable
        :users="users"
        :loading="loading"
        :error="error"
        :get-sort-indicator="getSortIndicator"
        :format-timestamp="formatTimestamp"
        @toggle-sort="toggleSort"
        @show-info="showInfoModal"
        @show-meta="showMetaModal"
        @show-edit="showEditModal"
        @delete="deleteUser"
      />
    </BasePanel>

    <CreateUserModal
      :is-open="showCreateModalFlag"
      :user-id="createUserId"
      :type="createType"
      @close="closeCreateModal"
      @submit="createUser"
      @update:userId="createUserId = $event"
      @update:type="createType = $event"
    />

    <EditUserModal
      :is-open="showEditModalFlag"
      :type="editType"
      @close="closeEditModal"
      @submit="updateUser"
      @update:type="editType = $event"
    />

    <UserMetaModal
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

    <UserInfoModal
      :is-open="showInfoModalFlag"
      :url="userInfoUrl"
      :content="jsonViewerContent"
      :copy-button-text="copyJsonButtonText"
      @close="closeInfoModal"
      @copy="copyJsonToClipboard"
    />

    <UserUrlModal
      :is-open="showUrlModalFlag"
      :url="generatedUrl"
      :copy-button-text="copyUrlButtonText"
      @close="closeUrlModal"
      @copy="copyUrlToClipboard"
    />
  </div>
</template>

<script setup lang="ts">
import { BasePanel } from '@/shared/ui';
import { useUsersPage } from '../model/useUsersPage';
import { UserFilterPanel } from './filters';
import { UserTable } from './tables';
import { UserInfoModal, UserMetaModal, UserUrlModal, CreateUserModal, EditUserModal } from './modals';
import { UsersPagination } from './pagination';

const {
  // State
  users,
  loading,
  error,
  currentPage,
  currentLimit,
  totalPages,
  totalUsers,
  filterInput,
  selectedFilterExample,
  showCreateModalFlag,
  showEditModalFlag,
  showMetaModalFlag,
  showInfoModalFlag,
  showUrlModalFlag,
  createUserId,
  createType,
  editUserId,
  editType,
  metaTags,
  newMetaKeyForEdit,
  newMetaValueForEdit,
  userInfoUrl,
  jsonViewerContent,
  copyJsonButtonText,
  generatedUrl,
  copyUrlButtonText,
  currentPageInput,
  // Computed
  paginationStart,
  paginationEnd,
  // Functions
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
  createUser,
  showEditModal,
  closeEditModal,
  updateUser,
  showMetaModal,
  closeMetaModal,
  addMetaTag,
  deleteMetaTag,
  showInfoModal,
  closeInfoModal,
  copyJsonToClipboard,
  deleteUser,
  selectUserFilterExample,
  clearUserFilter,
  applyUserFilter,
  showUrlModal,
  closeUrlModal,
  copyUrlToClipboard,
} = useUsersPage();
</script>

<style scoped>
/* Переносим все стили из оригинального HTML */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.users-page {
  height: 100%;
  display: flex;
  flex-direction: column;
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

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-small {
  padding: 4px 10px;
  font-size: 11px;
  margin-right: 5px;
}
</style>
