<template>
  <BaseModal :is-open="isOpen" title="Создать диалог" max-width="640px" @close="close">
    <div class="form-section">
      <label>👥 Участники диалога:</label>
      <div style="margin-top: 5px;">
        <BaseButton variant="url" @click="loadUsers" style="margin-bottom: 10px;">
          🔄 Загрузить пользователей
        </BaseButton>
        <div v-if="loadingUsers" style="display: block; color: #6c757d; font-size: 12px;">Загрузка...</div>
        <div v-else-if="usersError" style="color: #dc3545; font-size: 12px;">{{ usersError }}</div>
        <div v-else-if="users.length === 0 && usersLoaded" class="no-data" style="padding: 20px;">
          Пользователи не найдены
        </div>
        <div v-else-if="users.length > 0" class="member-list" style="display: block;">
          <div v-for="user in users" :key="user.userId" class="member-item">
            <input
              type="checkbox"
              :id="`member_${user.userId}`"
              :value="user.userId"
              class="member-checkbox"
              v-model="selectedMembers"
            />
            <label :for="`member_${user.userId}`">
              <strong>{{ user.userName }}</strong>
              <span style="color: #6c757d; font-size: 12px; margin-left: 5px;">({{ user.userId }})</span>
              <span style="color: #6c757d; font-size: 11px; margin-left: 5px;">[{{ user.userType }}]</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="meta-section">
      <h3>🏷️ Meta теги</h3>
      <p class="meta-hint">
        Если для диалогов зарегистрирован <code>required</code>-индекс (например
        <code>channelId</code> + <code>canonKeyValue</code>), укажите все обязательные ключи до создания.
      </p>
      <div v-if="metaTags.length === 0" class="no-tags">Мета-теги не добавлены</div>
      <table v-else class="meta-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tag in metaTags" :key="tag.key">
            <td><strong>{{ tag.key }}</strong></td>
            <td>{{ JSON.stringify(tag.value) }}</td>
            <td>
              <BaseButton type="button" variant="danger" size="small" @click="removeMetaTag(tag.key)">
                🗑️
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="meta-tag-row">
        <input
          type="text"
          v-model="localMetaKey"
          placeholder="key (например: serviceType)"
          @keydown.enter.prevent="addMetaTag"
        />
        <input
          type="text"
          v-model="localMetaValue"
          placeholder='value (например: "telegram" или 42)'
          @keydown.enter.prevent="addMetaTag"
        />
        <BaseButton type="button" variant="success" size="small" @click="addMetaTag">➕ Добавить</BaseButton>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="success" @click="create">✅ Создать диалог</BaseButton>
      <BaseButton variant="secondary" @click="close">Отмена</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface User {
  userId: string;
  userName: string;
  userType: string;
}

interface MetaTagRow {
  key: string;
  value: unknown;
}

interface Props {
  isOpen: boolean;
  users: User[];
  loadingUsers: boolean;
  usersError: string | null;
  usersLoaded: boolean;
  selectedMembers: string[];
  metaTags: MetaTagRow[];
  newMetaKey: string;
  newMetaValue: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'load-users'): void;
  (e: 'create'): void;
  (e: 'update:selectedMembers', value: string[]): void;
  (e: 'add-meta-tag'): void;
  (e: 'remove-meta-tag', key: string): void;
  (e: 'update:newMetaKey', value: string): void;
  (e: 'update:newMetaValue', value: string): void;
}>();

const selectedMembers = ref([...props.selectedMembers]);
const localMetaKey = ref(props.newMetaKey);
const localMetaValue = ref(props.newMetaValue);

watch(() => props.selectedMembers, (val) => {
  if (JSON.stringify(val) !== JSON.stringify(selectedMembers.value)) {
    selectedMembers.value = [...val];
  }
}, { deep: true });

watch(selectedMembers, (val, oldVal) => {
  if (JSON.stringify(val) !== JSON.stringify(oldVal)) {
    emit('update:selectedMembers', [...val]);
  }
}, { deep: true });

watch(() => props.newMetaKey, (val) => { localMetaKey.value = val; });
watch(() => props.newMetaValue, (val) => { localMetaValue.value = val; });
watch(localMetaKey, (val) => { emit('update:newMetaKey', val); });
watch(localMetaValue, (val) => { emit('update:newMetaValue', val); });

function close() {
  emit('close');
}

function loadUsers() {
  emit('load-users');
}

function create() {
  emit('create');
}

function addMetaTag() {
  emit('add-meta-tag');
}

function removeMetaTag(key: string) {
  emit('remove-meta-tag', key);
}
</script>

<style scoped>
.form-section {
  margin-bottom: 12px;
}

.form-section label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-size: 14px;
}

.member-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-checkbox {
  margin-right: 10px;
  cursor: pointer;
}

.member-item label {
  cursor: pointer;
  flex: 1;
  margin: 0;
}

.meta-section {
  margin-top: 4px;
  padding-top: 16px;
  border-top: 2px solid #e9ecef;
}

.meta-section h3 {
  font-size: 14px;
  margin: 0 0 8px;
  color: #333;
}

.meta-hint {
  font-size: 12px;
  color: #6c757d;
  margin: 0 0 12px;
  line-height: 1.4;
}

.meta-hint code {
  font-size: 11px;
  background: #f1f3f5;
  padding: 1px 4px;
  border-radius: 3px;
}

.no-tags {
  padding: 10px 0;
  color: #6c757d;
  font-size: 12px;
}

.meta-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}

.meta-table th {
  padding: 6px;
  font-size: 11px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e9ecef;
}

.meta-table td {
  padding: 6px;
  font-size: 12px;
  border-bottom: 1px solid #e9ecef;
  word-break: break-word;
}

.meta-tag-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.meta-tag-row input {
  flex: 1;
  min-width: 120px;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
}
</style>
