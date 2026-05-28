<template>
  <BaseModal :is-open="isOpen" title="Добавить реакцию" max-width="600px" @close="$emit('close')">
    <!-- Существующие реакции -->
    <div class="reactions-section">
      <h3>Реакции:</h3>
      <div class="reactions-box">
        <div v-if="existingReactions.length === 0" class="no-reactions">Реакций пока нет</div>
        <div v-else class="reactions-list">
          <button
            v-for="reaction in existingReactions"
            :key="reaction.reaction"
            type="button"
            class="reaction-item"
            :class="{ active: reaction.me }"
            @click="$emit('toggle-reaction', reaction.reaction)"
          >
            <span class="reaction-emoji">{{ reaction.reaction }}</span>
            <span class="reaction-count">{{ reaction.count }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Добавить реакцию -->
    <div class="add-reaction-section">
      <label>Добавить реакцию:</label>
      <div class="emoji-picker">
        <button
          v-for="emoji in ['👍', '❤️', '😂', '🔥', '🎉']"
          :key="emoji"
          type="button"
          class="emoji-btn"
          @click="$emit('toggle-reaction', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="secondary" @click="$emit('close')">Закрыть</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from '@/shared/ui';

interface Reaction {
  reaction: string;
  count: number;
  me: boolean;
}

interface Props {
  isOpen: boolean;
  existingReactions: Reaction[];
}

defineProps<Props>();
defineEmits<{
  (e: 'close'): void;
  (e: 'toggle-reaction', reaction: string): void;
}>();
</script>

<style scoped>
.reactions-section {
  margin-bottom: 25px;
}

.reactions-section h3 {
  margin-bottom: 15px;
  color: #333;
  font-size: 16px;
}

.reactions-box {
  min-height: 100px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 15px;
  background: #f8f9fa;
}

.no-reactions {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.reactions-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.reaction-item {
  font-size: 24px;
  padding: 8px 16px;
  border: 2px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  display: flex;
  align-items: center;
  gap: 8px;
}

.reaction-item.active {
  background: #4fc3f7;
  border-color: #4fc3f7;
  color: white;
  transform: scale(1.1);
}

.reaction-item:hover {
  background: #e9ecef;
}

.reaction-item.active:hover {
  background: #3db3e7;
}

.reaction-emoji {
  font-size: 20px;
}

.reaction-count {
  font-size: 14px;
  font-weight: 600;
}

.add-reaction-section label {
  display: block;
  margin-bottom: 15px;
  font-weight: 500;
  color: #495057;
}

.emoji-picker {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.emoji-btn {
  font-size: 32px;
  padding: 10px 20px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.emoji-btn:hover {
  background: #e9ecef;
  transform: scale(1.1);
}

</style>
