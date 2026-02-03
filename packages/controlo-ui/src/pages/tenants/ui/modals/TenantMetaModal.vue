<template>
  <BaseModal :is-open="isOpen" title="🏷️ Meta теги тенанта" max-width="800px" @close="close">
    <div class="meta-list">
      <h3 style="margin-bottom: 15px; font-size: 14px;">Текущие Meta теги:</h3>
      <div v-if="!metaTags || Object.keys(metaTags).length === 0" class="no-data">Meta теги отсутствуют</div>
      <table v-else class="meta-table">
        <thead>
          <tr><th>Key</th><th>Value</th><th>Действия</th></tr>
        </thead>
        <tbody>
          <tr v-for="(value, key) in metaTags" :key="key">
            <td><strong>{{ key }}</strong></td>
            <td>{{ JSON.stringify(value) }}</td>
            <td><BaseButton type="button" variant="danger" size="small" @click="deleteTag(String(key))">🗑️ Удалить</BaseButton></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="meta-section">
      <h3>Добавить Meta тег</h3>
      <div class="meta-tag-form">
        <div class="form-row">
          <label class="form-label">Ключ</label>
          <input type="text" v-model="newKey" placeholder="key (например: company)" class="form-input" />
        </div>
        <div class="form-row form-row-value">
          <div class="value-cell">
            <label class="form-label">Значение</label>
            <input v-if="valueType === 'any'" type="text" v-model="scalarValue" placeholder='value (прим: "internal", ["foo", "bar"], {"foo": "bar"}, 5, false)' class="form-input" />
            <template v-else-if="valueType === 'string' || valueType === 'number'">
              <input :type="valueType === 'number' ? 'number' : 'text'" v-model="scalarValue" :placeholder="valueType === 'number' ? '0' : 'Введите строку'" class="form-input" />
              <span v-if="valueError" class="form-error">{{ valueError }}</span>
            </template>
            <select v-else-if="valueType === 'boolean'" v-model="scalarValue" class="form-input form-input-inline">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
            <div v-else-if="valueType === 'array'" class="array-editor">
              <div v-for="(_, idx) in arrayItems" :key="idx" class="array-row">
                <input type="text" v-model="arrayItems[idx]" placeholder="Элемент" class="form-input" />
                <BaseButton type="button" variant="danger" size="small" @click="removeArrayItem(idx)">✕</BaseButton>
              </div>
              <BaseButton type="button" variant="secondary" size="small" @click="addArrayItem">➕ Добавить элемент</BaseButton>
            </div>
            <div v-else-if="valueType === 'object'" class="object-editor">
              <table class="object-table">
                <thead><tr><th>Ключ</th><th>Значение</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="(pair, idx) in objectPairs" :key="idx">
                    <td><input type="text" v-model="pair.key" placeholder="ключ" class="form-input cell-input" /></td>
                    <td><input type="text" v-model="pair.value" placeholder="значение" class="form-input cell-input" /></td>
                    <td><BaseButton type="button" variant="danger" size="small" @click="removeObjectPair(idx)">✕</BaseButton></td>
                  </tr>
                </tbody>
              </table>
              <BaseButton type="button" variant="secondary" @click="addObjectPair">➕ Добавить пару</BaseButton>
            </div>
          </div>
          <div class="type-cell">
            <label class="form-label">Тип значения</label>
            <select v-model="valueType" class="form-select-type">
              <option value="any">Общий (авто)</option>
              <option value="string">Строка</option>
              <option value="number">Число</option>
              <option value="boolean">Boolean</option>
              <option value="array">Массив</option>
              <option value="object">Объект</option>
            </select>
          </div>
        </div>
        <div class="form-row form-actions">
          <BaseButton type="button" variant="success" @click="addTag">➕ Добавить</BaseButton>
          <span v-if="addError" class="form-error">{{ addError }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

type ValueType = 'any' | 'string' | 'number' | 'boolean' | 'array' | 'object';

defineProps<{
  isOpen: boolean;
  metaTags: Record<string, any> | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add-meta-tag', key: string, value: any): void;
  (e: 'delete-meta-tag', key: string): void;
}>();

const newKey = ref('');
const valueType = ref<ValueType>('any');
const scalarValue = ref('');
const arrayItems = ref<string[]>([]);
const objectPairs = ref<Array<{ key: string; value: string }>>([]);
const valueError = ref('');
const addError = ref('');

watch(valueType, () => {
  scalarValue.value = valueType.value === 'boolean' ? 'true' : '';
  arrayItems.value = [];
  objectPairs.value = [];
  valueError.value = '';
  addError.value = '';
});

function parseMetaValueFromInput(inputValue: string): any {
  if (!inputValue || inputValue.trim() === '') return null;
  const trimmed = inputValue.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed)) return num;
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  if (trimmed.toLowerCase() === 'null') return null;
  if (trimmed.toLowerCase() === 'undefined') return undefined;
  return trimmed;
}

function close() {
  newKey.value = '';
  valueType.value = 'any';
  scalarValue.value = '';
  arrayItems.value = [];
  objectPairs.value = [];
  valueError.value = '';
  addError.value = '';
  emit('close');
}

function addArrayItem() { arrayItems.value.push(''); }
function removeArrayItem(index: number) { arrayItems.value.splice(index, 1); }
function addObjectPair() { objectPairs.value.push({ key: '', value: '' }); }
function removeObjectPair(index: number) { objectPairs.value.splice(index, 1); }

function buildValue(): any {
  valueError.value = '';
  if (valueType.value === 'any') return parseMetaValueFromInput(scalarValue.value);
  if (valueType.value === 'string') return scalarValue.value;
  if (valueType.value === 'number') {
    const v = scalarValue.value.trim();
    if (v === '') return null;
    const n = Number(v);
    if (Number.isNaN(n)) { valueError.value = 'Введите число'; return undefined; }
    return n;
  }
  if (valueType.value === 'boolean') return scalarValue.value === 'true';
  if (valueType.value === 'array') return arrayItems.value.map((s) => s.trim()).filter(Boolean);
  if (valueType.value === 'object') {
    const obj: Record<string, string> = {};
    for (const p of objectPairs.value) {
      const k = p.key.trim();
      if (k) obj[k] = p.value.trim();
    }
    return obj;
  }
  return null;
}

function addTag() {
  addError.value = '';
  const key = newKey.value.trim();
  if (!key) { addError.value = 'Введите ключ'; return; }
  const value = buildValue();
  if (value === undefined) return;
  if (valueType.value === 'array' && Array.isArray(value) && value.length === 0) {
    addError.value = 'Добавьте хотя бы один элемент массива';
    return;
  }
  if (valueType.value === 'any' && scalarValue.value.trim() === '') {
    addError.value = 'Введите значение';
    return;
  }
  emit('add-meta-tag', key, value);
  newKey.value = '';
  scalarValue.value = '';
  arrayItems.value = [];
  objectPairs.value = [];
}

function deleteTag(key: string) {
  emit('delete-meta-tag', key);
}
</script>

<style scoped>
.no-data { padding: 20px; text-align: center; color: #6c757d; }
.meta-list { margin-bottom: 20px; max-height: 300px; overflow-y: auto; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table th, .meta-table td { text-align: left; padding: 10px; }
.meta-table thead tr { border-bottom: 2px solid #dee2e6; background: #f8f9fa; }
.meta-table th { font-weight: 600; color: #495057; }
.meta-table tbody tr { border-bottom: 1px solid #e9ecef; }
.meta-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; }
.meta-section h3 { margin-bottom: 15px; font-size: 16px; color: #495057; }
.meta-tag-form { display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; flex-direction: column; gap: 4px; }
.form-row.form-actions { flex-direction: row; align-items: center; gap: 10px; }
.form-row-value { flex-direction: row; align-items: flex-start; gap: 12px; }
.value-cell { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.type-cell { flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
.form-label { font-size: 12px; font-weight: 600; color: #495057; }
.form-input, .form-select { padding: 8px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; }
.form-input-inline { width: auto; min-width: 100px; }
.form-select-type { width: 130px; padding: 7px 10px; font-size: 13px; border: 1px solid #ced4da; border-radius: 4px; background: #fff; color: #495057; cursor: pointer; }
.form-error { font-size: 12px; color: #dc3545; }
.array-editor, .object-editor { display: flex; flex-direction: column; gap: 8px; }
.array-row { display: flex; gap: 8px; align-items: center; }
.array-row .form-input { flex: 1; }
.object-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.object-table th, .object-table td { padding: 6px 8px; text-align: left; border: 1px solid #e9ecef; }
.object-table thead { background: #f8f9fa; }
.cell-input { width: 100%; min-width: 0; }
</style>
