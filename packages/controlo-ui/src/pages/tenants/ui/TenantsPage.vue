<template>
  <div class="tenants-page">
    <div class="page-header">
      <div class="page-header-left">
        <h1>🏢 Тенанты</h1>
        <button class="btn-success btn-small" @click="showCreateModal">➕ Создать тенант</button>
      </div>
      <div class="page-header-right">
        <button class="btn-primary btn-small" @click="showUrlModal">URL</button>
      </div>
    </div>

    <div class="page-container">
      <TenantFilterPanel
        :filter-input="filterInput"
        :selected-filter-example="selectedFilterExample"
        @update:filter-input="filterInput = $event"
        @update:selected-filter-example="selectedFilterExample = $event"
        @select-example="selectTenantFilterExample"
        @clear="clearTenantFilter"
        @apply="applyTenantFilter"
      />

      <div class="pagination" v-if="totalTenants > 0" id="pagination">
        <div class="pagination-info" id="paginationInfo">
          Показано {{ paginationStart }}-{{ paginationEnd }} из {{ totalTenants }} тенантов
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
    </div>

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
import { useTenantsPage } from '../model/useTenantsPage';
import TenantFilterPanel from './TenantFilterPanel.vue';
import {
  CreateTenantModal,
  TenantMetaModal,
  TenantInfoModal,
  TenantUrlModal,
  TenantTable,
} from '@/entities/tenant/ui';

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

.controls {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  display: flex;
  gap: 10px;
  align-items: center;
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

.pagination {
  padding: 15px 20px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-info {
  font-size: 13px;
  color: #6c757d;
}

.pagination-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pagination-controls input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
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

.filter-panel {
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #ffffff;
}

.filter-panel .form-section {
  margin-bottom: 12px;
}

.filter-panel label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.filter-panel select,
.filter-panel input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.filter-panel .input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-panel .input-with-clear input {
  padding-right: 30px;
}

.filter-panel .clear-field {
  position: absolute;
  right: 5px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 3px;
}

.filter-panel .clear-field:hover {
  background: #e9ecef;
  color: #333;
}

.filter-panel .form-actions {
  margin-top: 10px;
}

.sort-indicator {
  margin-left: 5px;
  font-size: 10px;
  color: #667eea;
}
</style>
