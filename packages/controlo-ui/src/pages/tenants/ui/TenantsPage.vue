<template>
  <div class="tenants-page">
    <BasePanel>
      <template #header-left>
        <span>🏢 Тенанты</span>
        <BaseButton variant="success" @click="showCreateModal">➕ Создать тенант</BaseButton>
      </template>
      <template #header-right>
        <BaseButton variant="url" @click="showUrlModal">🔗 URL</BaseButton>
      </template>
      <TenantFilterPanel
        :filter-input="filterInput"
        :selected-filter-example="selectedFilterExample"
        @update:filter-input="filterInput = $event"
        @update:selected-filter-example="selectedFilterExample = $event"
        @select-example="selectTenantFilterExample"
        @clear="clearTenantFilter"
        @apply="applyTenantFilter"
      />

      <TenantsPagination
        :current-page="currentPage"
        :current-page-input="currentPageInput"
        :total-pages="totalPages"
        :total="totalTenants"
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

      <TenantTable
        :tenants="tenants"
        :loading="loading"
        :error="error"
        :get-sort-indicator="getSortIndicator"
        :format-timestamp="formatTimestamp"
        @toggle-sort="toggleSort"
        @show-info="showInfoModal"
        @show-meta="showMetaModal"
        @delete="deleteTenant"
      />
    </BasePanel>

    <CreateTenantModal
      :is-open="showCreateModalFlag"
      :tenant-id="createTenantId"
      :meta-tags="createMetaTags"
      :new-meta-key="newMetaKey"
      :new-meta-value="newMetaValue"
      @close="closeCreateModal"
      @submit="createTenant"
      @add-meta-tag="addCreateMetaTag"
      @remove-meta-tag="removeCreateMetaTag"
      @update:tenant-id="createTenantId = $event"
      @update:new-meta-key="newMetaKey = $event"
      @update:new-meta-value="newMetaValue = $event"
    />

    <TenantMetaModal
      :is-open="showMetaModalFlag"
      :meta-tags="metaTags"
      :new-meta-key="newMetaKeyForEdit"
      :new-meta-value="newMetaValueForEdit"
      @close="closeMetaModal"
      @add-meta-tag="addMetaTag"
      @delete-meta-tag="deleteMetaTag"
      @update:new-meta-key="newMetaKeyForEdit = $event"
      @update:new-meta-value="newMetaValueForEdit = $event"
    />

    <TenantInfoModal
      :is-open="showInfoModalFlag"
      :url="infoUrl"
      :content="jsonViewerContent"
      :copy-button-text="copyJsonButtonText"
      @close="closeInfoModal"
      @copy="copyJsonToClipboard"
    />

    <TenantUrlModal
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
import { useTenantsPage } from '../model';
import { TenantFilterPanel } from './filters';
import { TenantTable } from './tables';
import { TenantInfoModal, TenantMetaModal, TenantUrlModal, CreateTenantModal } from './modals';
import { TenantsPagination } from './pagination';

const {
  // State
  tenants,
  loading,
  error,
  currentPage,
  currentLimit,
  totalPages,
  totalTenants,
  filterInput,
  selectedFilterExample,
  showCreateModalFlag,
  showMetaModalFlag,
  showInfoModalFlag,
  showUrlModalFlag,
  createTenantId,
  createMetaTags,
  newMetaKey,
  newMetaValue,
  metaTags,
  newMetaKeyForEdit,
  newMetaValueForEdit,
  infoUrl,
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
  addCreateMetaTag,
  removeCreateMetaTag,
  createTenant,
  showMetaModal,
  closeMetaModal,
  addMetaTag,
  deleteMetaTag,
  showInfoModal,
  closeInfoModal,
  copyJsonToClipboard,
  deleteTenant,
  selectTenantFilterExample,
  clearTenantFilter,
  applyTenantFilter,
  showUrlModal,
  closeUrlModal,
  copyUrlToClipboard,
} = useTenantsPage();
</script>

<style scoped>
/* Переносим все стили из оригинального HTML */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.tenants-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}


.controls {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  display: flex;
  gap: 10px;
  align-items: center;
}


.content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e9ecef;
}

th[style*='cursor: pointer'] {
  cursor: pointer;
  user-select: none;
}

th[style*='cursor: pointer']:hover {
  background: #e9ecef;
}

td {
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 13px;
}

tr:hover {
  background: #f8f9fa;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-size: 14px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #667eea;
  font-size: 14px;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 15px;
  font-size: 13px;
}

/* Modal */
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  margin: 50px auto;
  padding: 0;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s;
}

@keyframes slideIn {
  from {
    transform: translateY(-30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 16px;
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: #e9ecef;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #495057;
  font-size: 13px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #6c757d;
  font-size: 11px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge-active {
  background: #d4edda;
  color: #155724;
}

.badge-inactive {
  background: #f8d7da;
  color: #721c24;
}

.badge-type {
  background: #e3f2fd;
  color: #1976d2;
}

.meta-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e9ecef;
}

.meta-section h3 {
  font-size: 14px;
  margin-bottom: 15px;
  color: #333;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
}

.meta-tag-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.meta-list {
  max-height: 300px;
  overflow-y: auto;
}

.json-viewer {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  max-height: 500px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
