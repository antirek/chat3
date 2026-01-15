<template>
  <BaseModal :is-open="isOpen" title="🏷️ Meta теги тенанта" max-width="600px" @close="close">
    <div class="meta-list">
      <h3 v-if="metaTags" style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
      <div v-if="!metaTags || Object.keys(metaTags).length === 0" class="no-data">
        Meta теги отсутствуют
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(value, key) in metaTags" :key="key">
            <td><strong>{{ key }}</strong></td>
            <td>{{ JSON.stringify(value) }}</td>
            <td>
              <button class="btn-danger btn-small" @click="deleteTag(String(key))">
                🗑️ Удалить
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="meta-section">
      <h3>Добавить Meta тег</h3>
      <div class="meta-tag-row">
        <input type="text" v-model="localMetaKey" placeholder="key (например: company)" />
        <input type="text" v-model="localMetaValue" placeholder="value (например: My Company)" />
        <button class="btn-success btn-small" @click="addTag">➕ Добавить</button>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="close">Закрыть</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal } from '@/shared/ui';

interface Props {
  isOpen: boolean;
  metaTags: Record<string, any> | null;
  newMetaKey: string;
  newMetaValue: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add-meta-tag'): void;
  (e: 'delete-meta-tag', key: string): void;
  (e: 'update:newMetaKey', value: string): void;
  (e: 'update:newMetaValue', value: string): void;
}>();

const localMetaKey = ref(props.newMetaKey);
const localMetaValue = ref(props.newMetaValue);

watch(() => props.newMetaKey, (val) => { localMetaKey.value = val; });
watch(() => props.newMetaValue, (val) => { localMetaValue.value = val; });
watch(localMetaKey, (val) => { emit('update:newMetaKey', val); });
watch(localMetaValue, (val) => { emit('update:newMetaValue', val); });

function close() { emit('close'); }
function addTag() { emit('add-meta-tag'); }
function deleteTag(key: string) { emit('delete-meta-tag', key); }
</script>

<style scoped>
.meta-list { max-height: 300px; overflow-y: auto; }
.no-data { text-align: center; padding: 20px; color: #6c757d; font-size: 14px; }
table { width: 100%; border-collapse: collapse; }
th { padding: 12px 15px; text-align: left; font-weight: 600; color: #495057; font-size: 12px; border-bottom: 2px solid #e9ecef; }
td { padding: 12px 15px; border-bottom: 1px solid #e9ecef; font-size: 13px; }
tr:hover { background: #f8f9fa; }
.meta-section { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e9ecef; }
.meta-section h3 { font-size: 14px; margin-bottom: 15px; color: #333; }
.meta-tag-row { display: flex; gap: 8px; align-items: center; }
.meta-tag-row input { flex: 1; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; }
.btn-danger { background: #dc3545; color: white; border: none; padding: 4px 10px; font-size: 11px; border-radius: 4px; cursor: pointer; }
.btn-danger:hover { background: #c82333; }
.btn-success { background: #48bb78; color: white; border: none; padding: 4px 10px; font-size: 11px; border-radius: 4px; cursor: pointer; }
.btn-success:hover { background: #38a169; }
.btn-small { padding: 4px 10px; font-size: 11px; }
.btn-secondary { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500; }
.btn-secondary:hover { background: #5a6268; }
</style>
