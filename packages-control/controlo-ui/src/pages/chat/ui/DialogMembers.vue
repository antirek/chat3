<template>
  <div class="dialog-members">
    <div class="members-header">
      <h3>Участники</h3>
      <button
        class="add-member-button"
        :disabled="!enabled"
        @click="$emit('add-member')"
        title="Добавить участника"
      >
        ➕ Добавить участника
      </button>
    </div>
    
    <div v-if="loading" class="members-loading">
      Загрузка...
    </div>
    
    <div v-else-if="error" class="members-error">
      <div>Ошибка: {{ error }}</div>
    </div>
    
    <div v-else-if="members.length === 0" class="members-empty">
      Участников нет
    </div>
    
    <div v-else class="members-list">
      <div
        v-for="member in members"
        :key="member.userId"
        class="member-item"
        :class="{ 'member-active': member.isActive }"
      >
        <div class="member-info">
          <div class="member-name">
            {{ member.name || member.userId }}
          </div>
          <div class="member-details">
            <span class="member-id">{{ member.userId }}</span>
            <span v-if="member.userType" class="member-type">[{{ member.userType }}]</span>
          </div>
          <div v-if="member.role" class="member-role">
            Роль: {{ member.role }}
          </div>
        </div>
        <div v-if="member.unreadCount > 0" class="member-unread">
          {{ member.unreadCount }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  members: any[];
  loading?: boolean;
  error?: string | null;
  enabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  enabled: false,
});

defineEmits<{
  (e: 'add-member'): void;
}>();
</script>

<style scoped>
.dialog-members {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-left: 1px solid #e9ecef;
}

.members-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.members-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.add-member-button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background: #28a745;
  color: white;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.2s;
}

.add-member-button:hover:not(:disabled) {
  background: #218838;
}

.add-member-button:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.members-loading,
.members-error,
.members-empty {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  font-size: 12px;
}

.members-error {
  color: #d32f2f;
}

.members-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  background: #f8f9fa;
  transition: background-color 0.2s;
}

.member-item:hover {
  background: #e9ecef;
}

.member-item.member-active {
  border-color: #007bff;
  background: #e7f3ff;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-details {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6c757d;
  margin-bottom: 2px;
}

.member-id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-type {
  color: #495057;
}

.member-role {
  font-size: 10px;
  color: #6c757d;
  margin-top: 4px;
}

.member-unread {
  flex-shrink: 0;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dc3545;
  color: white;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
}
</style>
