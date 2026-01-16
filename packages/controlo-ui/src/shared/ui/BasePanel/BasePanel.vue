<template>
  <div class="base-panel" :style="panelStyle">
    <div v-if="$slots.header" class="base-panel-header">
      <slot name="header">
        <div class="header-left">
          <slot name="header-left"></slot>
        </div>
        <div class="header-right">
          <slot name="header-right"></slot>
        </div>
      </slot>
    </div>
    <div class="base-panel-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  width?: string;
  minWidth?: string;
  maxWidth?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: undefined,
  minWidth: undefined,
  maxWidth: undefined,
});

const panelStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.width) style.width = props.width;
  if (props.minWidth) style.minWidth = props.minWidth;
  if (props.maxWidth) style.maxWidth = props.maxWidth;
  return style;
});
</script>

<style scoped>
.base-panel {
  background: white;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  min-height: 0;
}

.base-panel-header {
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
  flex-shrink: 0;
}

:deep(.header-left) {
  display: flex;
  align-items: center;
  gap: 15px;
}

:deep(.header-right) {
  display: flex;
  align-items: center;
  gap: 10px;
}

.base-panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
</style>
