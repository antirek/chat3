<template>
  <button
    :class="buttonClass"
    :style="buttonStyle"
    :disabled="disabled"
    :type="type"
    @click="$emit('click', $event)"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'success' | 'danger' | 'secondary' | 'url' | 'reactions' | 'events' | 'status-matrix' | 'statuses' | 'set-status';
  size?: 'default' | 'small';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  color?: string; // Кастомный цвет фона
  hoverColor?: string; // Кастомный цвет при наведении
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'default',
  disabled: false,
  type: 'button',
  color: undefined,
  hoverColor: undefined,
});

defineEmits<{
  click: [event: MouseEvent];
}>();

const buttonClass = computed(() => {
  const classes = [
    'base-button',
    `base-button--${props.size}`,
  ];
  
  // Добавляем variant класс только если не передан кастомный цвет
  // (иначе CSS класс может перекрыть inline style)
  if (!props.color) {
    classes.push(`base-button--${props.variant}`);
  } else {
    // Если есть кастомный цвет, всё равно добавляем базовый класс для размеров
    classes.push('base-button--custom-color');
  }
  
  return classes;
});

const buttonStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.color) {
    style.background = props.color;
    style.color = 'white'; // По умолчанию белый текст для кастомного цвета
  }
  if (props.hoverColor) {
    // Для hover цвета используем CSS переменную или data-атрибут
    style['--hover-color'] = props.hoverColor;
  }
  return style;
});
</script>

<style scoped>
.base-button {
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Размеры */
.base-button--default {
  padding: 6px 12px;
  font-size: 12px;
  max-height: 28px;
}

.base-button--small {
  padding: 3px 6px;
  font-size: 11px;
  font-weight: normal;
  margin: 1px;
}

/* Варианты */
.base-button--primary {
  background: #667eea;
  color: white;
}

.base-button--success {
  background: #28a745;
  color: white;
}

.base-button--danger {
  background: #dc3545;
  color: white;
}

.base-button--secondary {
  background: #6c757d;
  color: white;
}

.base-button--url {
  background: #667eea;
  color: white;
  font-weight: normal;
}

/* Дополнительные варианты для таблиц */
.base-button--reactions {
  background: #f655a0;
  color: white;
}

.base-button--events {
  background: #9c27b0;
  color: white;
}

.base-button--status-matrix {
  background: #57531e;
  color: white;
}

.base-button--statuses {
  background: #063357;
  color: white;
}

.base-button--set-status {
  background: #6c757d;
  color: white;
}

/* Универсальный hover эффект - затемнение базового цвета */
.base-button:not(.base-button--custom-color):hover:not(:disabled) {
  filter: brightness(0.85);
}

/* Кастомный цвет через style */
.base-button--custom-color:hover:not(:disabled) {
  opacity: 0.9;
  filter: brightness(0.9);
}

/* Если задан hoverColor через CSS переменную */
.base-button--custom-color[style*='--hover-color']:hover:not(:disabled) {
  background: var(--hover-color) !important;
  opacity: 1;
  filter: none;
}
</style>
