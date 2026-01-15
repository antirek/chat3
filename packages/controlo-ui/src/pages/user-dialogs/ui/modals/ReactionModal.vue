<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Добавить реакцию</h2>
        <span class="close" @click="close">&times;</span>
      </div>
      <div class="modal-body">
        <!-- Секция реакций -->
        <div id="existingReactionsSection" style="margin-bottom: 25px;">
          <h3 style="margin-bottom: 15px; color: #333; font-size: 16px;">Реакции:</h3>
          <div id="existingReactionsList" style="min-height: 100px; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; background: #f8f9fa;">
            <div v-if="existingReactions.length === 0" class="loading">Реакций пока нет</div>
            <div v-else style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
              <button
                v-for="reaction in existingReactions"
                :key="reaction.reaction"
                type="button"
                class="reaction-item-btn"
                :class="{ active: reaction.me }"
                @click="toggleReaction(reaction.reaction)"
                style="font-size: 24px; padding: 8px 16px; border: 2px solid; border-radius: 20px; cursor: pointer; transition: all 0.2s;"
              >
                <span style="font-size: 20px;">{{ reaction.reaction }}</span>
                <span style="margin-left: 8px; font-size: 14px; font-weight: 600;">{{ reaction.count }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Форма добавления реакции -->
        <form id="addReactionForm">
          <div class="form-group">
            <label>Добавить реакцию:</label>
            <div class="reactions-container" style="display: flex; gap: 15px; justify-content: center; padding: 20px 0; flex-wrap: wrap;">
              <button
                type="button"
                class="reaction-btn"
                @click="toggleReaction('👍')"
                style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
              >
                👍
              </button>
              <button
                type="button"
                class="reaction-btn"
                @click="toggleReaction('❤️')"
                style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
              >
                ❤️
              </button>
              <button
                type="button"
                class="reaction-btn"
                @click="toggleReaction('😂')"
                style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
              >
                😂
              </button>
              <button
                type="button"
                class="reaction-btn"
                @click="toggleReaction('🔥')"
                style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
              >
                🔥
              </button>
              <button
                type="button"
                class="reaction-btn"
                @click="toggleReaction('🎉')"
                style="font-size: 32px; padding: 10px 20px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
              >
                🎉
              </button>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="close">Закрыть</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Reaction {
  reaction: string;
  count: number;
  me: boolean;
}

interface Props {
  isOpen: boolean;
  existingReactions: Reaction[];
}

interface Emits {
  (e: 'close'): void;
  (e: 'toggle-reaction', reaction: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function close() {
  emit('close');
}

function toggleReaction(reaction: string) {
  emit('toggle-reaction', reaction);
}
</script>

<style scoped>
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  background-color: #fefefe;
  margin: 3% auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  background: #f8f9fa;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close {
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
}

.close:hover,
.close:focus {
  color: #000;
  text-decoration: none;
}

.modal-body {
  padding: 20px;
  max-height: calc(90vh - 100px);
  overflow-y: auto;
}

.loading {
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
}

.reaction-item-btn {
  font-size: 24px;
  padding: 8px 16px;
  border: 2px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.reaction-item-btn.active {
  background: #4fc3f7;
  border-color: #4fc3f7;
  color: white;
  transform: scale(1.1);
}

.reaction-item-btn:hover {
  background: #e9ecef;
}

.reaction-item-btn.active:hover {
  background: #3db3e7;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #495057;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.form-actions button {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}
</style>
