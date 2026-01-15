<template>
  <BaseModal :is-open="isOpen" title="Создать тенант" max-width="600px" @close="close">
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="createTenantId">Tenant ID</label>
        <input type="text" id="createTenantId" v-model="localTenantId" placeholder="my_tenant" maxlength="20" />
        <small>Опционально. Максимум 20 символов. Если не указан, будет сгенерирован автоматически.</small>
      </div>
      <div class="meta-section">
        <h3>Мета-теги (опционально)</h3>
        <div v-if="metaTags.length === 0" class="no-tags">Мета-теги не добавлены</div>
        <table v-else>
          <thead>
            <tr><th>Key</th><th>Value</th><th>Действия</th></tr>
          </thead>
          <tbody>
            <tr v-for="tag in metaTags" :key="tag.key">
              <td><strong>{{ tag.key }}</strong></td>
              <td>{{ JSON.stringify(tag.value) }}</td>
              <td><button type="button" class="btn-danger btn-small" @click="removeMetaTag(tag.key)">🗑️</button></td>
            </tr>
          </tbody>
        </table>
        <div class="meta-tag-row">
          <input type="text" v-model="localMetaKey" placeholder="key (например: company)" />
          <input type="text" v-model="localMetaValue" placeholder="value (например: My Company)" />
          <button type="button" class="btn-success btn-small" @click="addMetaTag">➕ Добавить</button>
        </div>
      </div>
    </form>
    <template #footer>
      <button type="button" class="btn-secondary" @click="close">Отмена</button>
      <button type="button" class="btn-success" @click="handleSubmit">Создать</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  tenantId: string;
  metaTags: Array<{ key: string; value: any }>;
  newMetaKey: string;
  newMetaValue: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'add-meta-tag'): void;
  (e: 'remove-meta-tag', key: string): void;
  (e: 'update:tenantId', value: string): void;
  (e: 'update:newMetaKey', value: string): void;
  (e: 'update:newMetaValue', value: string): void;
}>();

const localTenantId = ref(props.tenantId);
const localMetaKey = ref(props.newMetaKey);
const localMetaValue = ref(props.newMetaValue);

watch(() => props.tenantId, (val) => { localTenantId.value = val; });
watch(() => props.newMetaKey, (val) => { localMetaKey.value = val; });
watch(() => props.newMetaValue, (val) => { localMetaValue.value = val; });
watch(localTenantId, (val) => { emit('update:tenantId', val); });
watch(localMetaKey, (val) => { emit('update:newMetaKey', val); });
watch(localMetaValue, (val) => { emit('update:newMetaValue', val); });

function close() { emit('close'); }
function handleSubmit() { emit('submit'); }
function addMetaTag() { emit('add-meta-tag'); }
function removeMetaTag(key: string) { emit('remove-meta-tag', key); }
</script>

<style scoped>
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: #495057; font-size: 13px; }
.form-group input { width: 100%; padding: 8px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; }
.form-group small { display: block; margin-top: 4px; color: #6c757d; font-size: 11px; }
.meta-section { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e9ecef; }
.meta-section h3 { font-size: 14px; margin-bottom: 15px; color: #333; }
.no-tags { padding: 10px; color: #6c757d; font-size: 12px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
th { padding: 6px; font-size: 11px; text-align: left; font-weight: 600; border-bottom: 1px solid #e9ecef; }
td { padding: 6px; font-size: 12px; border-bottom: 1px solid #e9ecef; }
.meta-tag-row { display: flex; gap: 8px; align-items: center; }
.meta-tag-row input { flex: 1; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; }
.btn-danger { background: #dc3545; color: white; border: none; padding: 4px 10px; font-size: 11px; border-radius: 4px; cursor: pointer; }
.btn-danger:hover { background: #c82333; }
.btn-success { background: #48bb78; color: white; border: none; padding: 8px 16px; font-size: 13px; border-radius: 4px; cursor: pointer; font-weight: 500; }
.btn-success:hover { background: #38a169; }
.btn-small { padding: 4px 10px; font-size: 11px; }
.btn-secondary { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; }
.btn-secondary:hover { background: #5a6268; }
</style>
