<template>
  <div class="models-panel">
    <div class="models-panel-header">Модели</div>
    <div class="models-list">
      <div v-if="loading" class="loading">Загрузка моделей...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="Object.keys(modelsByCategory).length === 0" class="empty">Модели не найдены</div>
      <template v-else>
        <div v-for="(categoryModels, categoryName) in modelsByCategory" :key="categoryName" class="model-category">
          <div class="model-category-header">{{ categoryName }}</div>
          <div
            v-for="model in categoryModels"
            :key="model.name"
            class="model-item"
            :class="{ active: currentModel === model.name }"
            @click="$emit('select-model', model.name)"
          >
            {{ model.name }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  loading: boolean;
  error: string | null;
  modelsByCategory: Record<string, any[]>;
  currentModel: string | null;
}

interface Emits {
  (e: 'select-model', modelName: string): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
.models-panel {
  width: 250px;
  background: white;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.models-panel-header {
  display: flex;
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600;
  color: #495057;
  font-size: 16px;
  min-height: 59px;
  align-items: center;
}

.models-list {
  flex: 1;
  overflow-y: auto;
}

.model-category {
  margin-bottom: 10px;
}

.model-category-header {
  padding: 10px 20px;
  font-weight: 600;
  font-size: 12px;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.model-item {
  padding: 10px 20px 10px 30px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 3px solid transparent;
  font-size: 14px;
}

.model-item:hover {
  background-color: #f8f9fa;
}

.model-item.active {
  background-color: #e7f3ff;
  border-left-color: #667eea;
  font-weight: 600;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.error {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin: 20px;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}
</style>
