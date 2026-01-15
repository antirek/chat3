<template>
  <BaseModal :is-open="isOpen" title="Выбрать диапазон дат" max-width="700px" @close="close">
    <div class="date-range-container">
      <div class="date-range-presets">
        <button v-for="preset in datePresets" :key="preset.value" class="date-preset-btn" :class="{ active: selectedDatePreset === preset.value }" @click="$emit('select-preset', preset.value)">
          {{ preset.label }}
        </button>
      </div>
      <div class="date-range-calendar">
        <div class="date-inputs">
          <div class="date-input-wrapper">
            <input type="date" v-model="localDateFrom" />
          </div>
          <div class="date-input-wrapper">
            <input type="date" v-model="localDateTo" />
          </div>
        </div>
        <div class="calendar-container">
          <div class="calendar-header">
            <button class="calendar-nav-btn" @click="$emit('change-month', -1)">‹</button>
            <div class="calendar-month-year">{{ calendarMonthYear }}</div>
            <button class="calendar-nav-btn" @click="$emit('change-month', 1)">›</button>
          </div>
          <div class="calendar-grid">
            <div v-for="dayHeader in ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']" :key="dayHeader" class="calendar-day-header">{{ dayHeader }}</div>
            <div v-for="(day, index) in calendarDays" :key="index" class="calendar-day" :class="getCalendarDayClass(day)" @click="$emit('select-date', day)">{{ day.date }}</div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="close">Отмена</button>
      <button type="button" class="btn-primary" @click="$emit('apply')">Применить</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { BaseModal } from '@/shared/ui';

interface Day { date: number; fullDate: Date; isCurrentMonth: boolean; }
interface Props {
  isOpen: boolean; selectedDatePreset: string; dateRangeFrom: string; dateRangeTo: string;
  calendarMonthYear: string; calendarDays: Day[]; datePresets: Array<{ value: string; label: string }>;
  getCalendarDayClass: (day: Day) => string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void; (e: 'select-preset', preset: string): void; (e: 'change-month', delta: number): void;
  (e: 'select-date', day: Day): void; (e: 'apply'): void;
  (e: 'update:dateRangeFrom', value: string): void; (e: 'update:dateRangeTo', value: string): void;
}>();

const localDateFrom = ref(props.dateRangeFrom);
const localDateTo = ref(props.dateRangeTo);

watch(() => props.dateRangeFrom, (val) => { localDateFrom.value = val; });
watch(() => props.dateRangeTo, (val) => { localDateTo.value = val; });
watch(localDateFrom, (val) => { emit('update:dateRangeFrom', val); });
watch(localDateTo, (val) => { emit('update:dateRangeTo', val); });

function close() { emit('close'); }
</script>

<style scoped>
.date-range-container { display: flex; gap: 15px; min-height: 280px; }
.date-range-presets { width: 180px; display: flex; flex-direction: column; gap: 6px; padding-right: 15px; border-right: 1px solid #e9ecef; }
.date-preset-btn { padding: 8px 12px; border: none; border-radius: 4px; background: #f8f9fa; color: #495057; cursor: pointer; font-size: 13px; text-align: left; }
.date-preset-btn:hover { background: #e9ecef; }
.date-preset-btn.active { background: #667eea; color: white; }
.date-range-calendar { flex: 1; display: flex; flex-direction: column; }
.date-inputs { display: flex; gap: 8px; margin-bottom: 12px; }
.date-input-wrapper { flex: 1; }
.date-input-wrapper input { width: 100%; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 12px; }
.calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.calendar-nav-btn { background: none; border: none; font-size: 14px; cursor: pointer; color: #495057; padding: 3px 6px; border-radius: 3px; }
.calendar-month-year { font-weight: 600; font-size: 13px; color: #495057; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.calendar-day-header { text-align: center; font-weight: 600; font-size: 10px; color: #6c757d; padding: 4px 2px; }
.calendar-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 3px; cursor: pointer; font-size: 11px; background: white; min-height: 24px; }
.calendar-day:hover { background: #f8f9fa; }
.calendar-day.other-month { color: #ced4da; }
.calendar-day.selected, .calendar-day.range-start, .calendar-day.range-end { background: #667eea; color: white; }
.calendar-day.in-range { background: #e7f3ff; }
.btn-primary { padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary { padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; }
</style>
