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

    <MetaModal
      :is-open="showMetaModalFlag"
      title="🏷️ Meta теги тенанта"
      :loading="loading"
      :meta-tags="metaTags"
      key-placeholder="key (например: company)"
      value-placeholder='value (прим: "internal", ["foo", "bar"], {"foo": "bar"}, 5, false)'
      @close="closeMetaModal"
      @add-tag="(key, value) => addMetaTag(key, value)"
      @delete-tag="deleteMetaTag"
    />

    <TenantInfoModal
      :is-open="showInfoModalFlag"
      :url="infoUrl"
      :content="jsonViewerContent"
      :copy-button-text="copyJsonButtonText"
      @close="closeInfoModal"
      @copy="(button) => copyJsonToClipboard(button)"
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
import { TenantInfoModal, TenantUrlModal, CreateTenantModal } from './modals';
import { TenantsPagination } from './pagination';
import { MetaModal } from '@/widgets/meta-modal';

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
.tenants-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
