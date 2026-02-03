<template>
  <div class="users-page">
    <BasePanel>
      <template #header-left>
        <span>👤 Пользователи</span>
        <BaseButton variant="success" @click="showCreateModal">➕ Создать пользователя</BaseButton>
      </template>
      <template #header-right>
        <BaseButton variant="url" @click="showUrlModal">🔗 URL</BaseButton>
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
      @close="closeMetaModal"
      @add-meta-tag="(key, value) => addMetaTag(key, value)"
      @delete-meta-tag="deleteMetaTag"
    />

    <UserInfoModal
      :is-open="showInfoModalFlag"
      :url="userInfoUrl"
      :content="jsonViewerContent"
      :copy-button-text="copyJsonButtonText"
      @close="closeInfoModal"
      @copy="(button) => copyJsonToClipboard(button)"
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
import { BasePanel, BaseButton } from '@/shared/ui';
import { useUsersPage } from '../model';
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
</style>
