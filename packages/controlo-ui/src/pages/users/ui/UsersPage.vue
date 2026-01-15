<template>
  <div class="users-page">
    <div class="page-header">
      <div class="page-header-left">
        <h1>👤 Пользователи</h1>
        <button class="btn-success btn-small" @click="showCreateModal">➕ Создать пользователя</button>
      </div>
      <div class="page-header-right">
        <button class="btn-primary btn-small" @click="showUrlModal">URL</button>
      </div>
    </div>

    <div class="page-container">
      <UserFilterPanel
        :filter-input="filterInput"
        :selected-filter-example="selectedFilterExample"
        @update:filter-input="filterInput = $event"
        @update:selected-filter-example="selectedFilterExample = $event"
        @select-example="selectUserFilterExample"
        @clear="clearUserFilter"
        @apply="applyUserFilter"
      />

      <div class="pagination" v-if="totalUsers > 0" id="pagination">
        <div class="pagination-info" id="paginationInfo">
          Показано {{ paginationStart }}-{{ paginationEnd }} из {{ totalUsers }} пользователей
        </div>
        <div class="pagination-controls">
          <button
            class="btn-secondary btn-small"
            @click="goToFirstPage"
            :disabled="currentPage <= 1"
          >
            ⏮ Первая
          </button>
          <button
            class="btn-secondary btn-small"
            @click="goToPreviousPage"
            :disabled="currentPage <= 1"
          >
            ◀ Предыдущая
          </button>
          <span style="font-size: 12px; margin: 0 8px;">Страница</span>
          <input
            type="number"
            id="currentPageInput"
            v-model.number="currentPageInput"
            :min="1"
            :max="totalPages"
            @change="goToPage(currentPageInput)"
          />
          <span style="font-size: 12px; margin: 0 8px;">из</span>
          <span id="totalPages" style="font-size: 12px;">{{ totalPages }}</span>
          <button
            class="btn-secondary btn-small"
            @click="goToNextPage"
            :disabled="currentPage >= totalPages"
          >
            Следующая ▶
          </button>
          <button
            class="btn-secondary btn-small"
            @click="goToLastPage"
            :disabled="currentPage >= totalPages"
          >
            Последняя ⏭
          </button>
          <span style="font-size: 12px; margin-left: 12px;">Показать:</span>
          <select
            id="pageLimit"
            v-model.number="currentLimit"
            @change="changeLimit(currentLimit)"
            style="padding: 4px 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px;"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>

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
    </div>

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
import { useUsersPage } from '../model/useUsersPage';
import UserFilterPanel from './UserFilterPanel.vue';
import { UserTable } from './tables';
import { UserInfoModal, UserMetaModal, UserUrlModal, CreateUserModal, EditUserModal } from './modals';

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

.pagination {
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.pagination-info {
  font-size: 11px;
  color: #666;
  margin-left: 10px;
}

.pagination-controls {
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
}

.pagination-controls button,
.pagination-controls button.btn-secondary,
.pagination-controls button.btn-small {
  padding: 5px 10px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
  margin-right: 0;
}

.pagination-controls button:hover:not(:disabled),
.pagination-controls button.btn-secondary:hover:not(:disabled) {
  background: #e9ecef;
  color: #333;
}

.pagination-controls button:disabled,
.pagination-controls button.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-controls input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #667eea;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  background: #667eea;
  color: white;
}

.pagination-controls span {
  font-size: 11px;
  color: #666;
}

.pagination-controls select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}
</style>
