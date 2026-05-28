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
      <BaseButton variant="secondary" @click="close">Отмена</BaseButton>
      <BaseButton variant="success" @click="$emit('apply')">Применить</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { BaseModal, BaseButton } from '@/shared/ui';

interface Day { date: number; fullDate: Date; isCurrentMonth: boolean; }
interface Props {
  isOpen: boolean; 
  selectedDatePreset: string; 
  dateRangeFrom: string; 
  dateRangeTo: string;
  calendarMonthYear: string; 
  calendarDays: Day[]; 
  datePresets: Array<{ value: string; label: string }>;
  selectedDateRange: { from: Date | null; to: Date | null };
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void; 
  (e: 'select-preset', preset: string): void; 
  (e: 'change-month', delta: number): void;
  (e: 'select-date', day: Day): void; 
  (e: 'apply'): void;
  (e: 'update:dateRangeFrom', value: string): void; 
  (e: 'update:dateRangeTo', value: string): void;
}>();

const localDateFrom = ref(props.dateRangeFrom);
const localDateTo = ref(props.dateRangeTo);

watch(() => props.dateRangeFrom, (val) => { localDateFrom.value = val; });
watch(() => props.dateRangeTo, (val) => { localDateTo.value = val; });
watch(localDateFrom, (val) => { emit('update:dateRangeFrom', val); });
watch(localDateTo, (val) => { emit('update:dateRangeTo', val); });

function getCalendarDayClass(day: Day): string {
  const classes: string[] = [];
  
  if (!day.isCurrentMonth) {
    classes.push('other-month');
  }
  
  const dayNormalized = new Date(day.fullDate.getFullYear(), day.fullDate.getMonth(), day.fullDate.getDate());
  const dayTime = dayNormalized.getTime();
  
  // Проверяем, выбрана ли только одна дата (from есть, но to нет)
  if (props.selectedDateRange.from && !props.selectedDateRange.to) {
    const fromNormalized = new Date(props.selectedDateRange.from.getFullYear(), 
                                    props.selectedDateRange.from.getMonth(), 
                                    props.selectedDateRange.from.getDate());
    const fromTime = fromNormalized.getTime();
    
    if (dayTime === fromTime) {
      classes.push('selected');
    }
  }
  
  // Проверяем диапазон дат (from и to выбраны)
  if (props.selectedDateRange.from && props.selectedDateRange.to) {
    const fromNormalized = new Date(props.selectedDateRange.from.getFullYear(), 
                                    props.selectedDateRange.from.getMonth(), 
                                    props.selectedDateRange.from.getDate());
    const toNormalized = new Date(props.selectedDateRange.to.getFullYear(), 
                                  props.selectedDateRange.to.getMonth(), 
                                  props.selectedDateRange.to.getDate());
    
    const fromTime = fromNormalized.getTime();
    const toTime = toNormalized.getTime();
    
    if (dayTime >= fromTime && dayTime <= toTime) {
      classes.push('in-range');
      if (dayTime === fromTime) {
        classes.push('range-start');
      }
      if (dayTime === toTime) {
        classes.push('range-end');
      }
    }
  }
  
  return classes.join(' ');
}

function close() { emit('close'); }
</script>

<style scoped>
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
</style>
