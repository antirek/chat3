<template>
  <div v-if="isOpen" class="modal" @click.self="close">
    <div class="modal-content date-range-modal-content">
      <div class="modal-header">
        <h2 class="modal-title">Выбрать диапазон дат</h2>
        <button class="modal-close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="date-range-container">
          <!-- Левая панель с предустановками -->
          <div class="date-range-presets">
            <button
              v-for="preset in datePresets"
              :key="preset.value"
              class="date-preset-btn"
              :class="{ active: selectedDatePreset === preset.value }"
              @click="$emit('select-preset', preset.value)"
            >
              {{ preset.label }}
            </button>
            <div style="flex: 1;"></div>
            <div class="date-range-actions" style="border-top: none; padding-top: 0; margin-top: 0;">
              <button type="button" class="btn btn-secondary" @click="close" style="flex: 1;">Отмена</button>
              <button type="button" class="btn btn-primary" @click="$emit('apply')" style="flex: 1; background: #28a745;">Применить</button>
            </div>
          </div>
          
          <!-- Правая панель с календарем -->
          <div class="date-range-calendar">
            <div class="date-inputs">
              <div class="date-input-wrapper">
                <input type="date" v-model="dateRangeFrom" />
              </div>
              <div class="date-input-wrapper">
                <input type="date" v-model="dateRangeTo" />
              </div>
            </div>
            <div class="calendar-container">
              <div class="calendar-header">
                <button class="calendar-nav-btn" @click="$emit('change-month', -1)">‹</button>
                <div class="calendar-month-year">{{ calendarMonthYear }}</div>
                <button class="calendar-nav-btn" @click="$emit('change-month', 1)">›</button>
              </div>
              <div class="calendar-grid">
                <div
                  v-for="dayHeader in ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']"
                  :key="dayHeader"
                  class="calendar-day-header"
                >
                  {{ dayHeader }}
                </div>
                <div
                  v-for="(day, index) in calendarDays"
                  :key="index"
                  class="calendar-day"
                  :class="getCalendarDayClass(day)"
                  @click="$emit('select-date', day)"
                >
                  {{ day.date }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Day {
  date: number;
  fullDate: Date;
  isCurrentMonth: boolean;
}

interface Props {
  isOpen: boolean;
  selectedDatePreset: string;
  dateRangeFrom: string;
  dateRangeTo: string;
  calendarMonthYear: string;
  calendarDays: Day[];
  datePresets: Array<{ value: string; label: string }>;
  getCalendarDayClass: (day: Day) => string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'select-preset', preset: string): void;
  (e: 'change-month', delta: number): void;
  (e: 'select-date', day: Day): void;
  (e: 'apply'): void;
  (e: 'update:dateRangeFrom', value: string): void;
  (e: 'update:dateRangeTo', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Используем локальные refs для синхронизации с родителем
const dateRangeFrom = ref(props.dateRangeFrom);
const dateRangeTo = ref(props.dateRangeTo);

watch(() => props.dateRangeFrom, (val) => {
  dateRangeFrom.value = val;
});

watch(() => props.dateRangeTo, (val) => {
  dateRangeTo.value = val;
});

watch(dateRangeFrom, (val) => {
  emit('update:dateRangeFrom', val);
});

watch(dateRangeTo, (val) => {
  emit('update:dateRangeTo', val);
});

function close() {
  emit('close');
}
</script>

<style scoped>
.modal {
  display: flex;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: white;
  margin: 5% auto;
  padding: 0;
  border-radius: 8px;
  width: 80%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.date-range-modal-content {
  max-width: 700px;
  width: 90%;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.date-range-container {
  display: flex;
  gap: 15px;
  min-height: 280px;
}

.date-range-presets {
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 15px;
  border-right: 1px solid #e9ecef;
}

.date-preset-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #f8f9fa;
  color: #495057;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: all 0.2s;
}

.date-preset-btn:hover {
  background: #e9ecef;
}

.date-preset-btn.active {
  background: #667eea;
  color: white;
}

.date-range-calendar {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.date-inputs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.date-input-wrapper {
  flex: 1;
  position: relative;
}

.date-input-wrapper input {
  width: 100%;
  padding: 6px 10px 6px 32px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
}

.date-input-wrapper::before {
  content: '📅';
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
}

.calendar-container {
  flex: 1;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.calendar-nav-btn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #495057;
  padding: 3px 6px;
  border-radius: 3px;
  transition: background 0.2s;
}

.calendar-nav-btn:hover {
  background: #f8f9fa;
}

.calendar-month-year {
  font-weight: 600;
  font-size: 13px;
  color: #495057;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day-header {
  text-align: center;
  font-weight: 600;
  font-size: 10px;
  color: #6c757d;
  padding: 4px 2px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
  background: white;
  min-height: 24px;
}

.calendar-day:hover {
  background: #f8f9fa;
}

.calendar-day.other-month {
  color: #ced4da;
}

.calendar-day.selected {
  background: #667eea;
  color: white;
  font-weight: 600;
}

.calendar-day.range-start {
  background: #667eea;
  color: white;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.calendar-day.range-end {
  background: #667eea;
  color: white;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

.calendar-day.in-range {
  background: #e7f3ff;
  color: #495057;
}

.date-range-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}
</style>
