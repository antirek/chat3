<template>
  <div class="dialogs-packs-chart">
    <div v-if="loading" class="chart-loading">Загрузка данных...</div>
    <div v-else-if="error" class="chart-error">Ошибка: {{ error }}</div>
    <div v-else-if="!chartData" class="chart-empty">Нет данных</div>
    <canvas v-else ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface Props {
  dates: string[];
  dialogs: number[];
  packs: number[];
  loading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null
});

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const chartData = computed(() => {
  if (!props.dates || props.dates.length === 0) return null;
  return {
    labels: props.dates,
    datasets: [
      {
        label: 'Диалоги',
        data: props.dialogs,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Паки',
        data: props.packs,
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
        borderColor: 'rgba(255, 159, 64, 1)',
        borderWidth: 1
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      ticks: { maxRotation: 45, minRotation: 45 }
    },
    y: {
      beginAtZero: true,
      ticks: { stepSize: 1 }
    }
  },
  plugins: {
    legend: { display: true, position: 'top' as const },
    title: { display: true, text: 'Созданные диалоги и паки по дням (30 дней)' }
  }
};

function renderChart() {
  nextTick().then(() => {
    if (!chartCanvas.value || !chartData.value) return;
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    chartInstance = new Chart(chartCanvas.value, {
      type: 'bar',
      data: chartData.value,
      options: chartOptions
    });
  });
}

watch(() => chartData.value, (val) => { if (val) renderChart(); }, { deep: true });

onMounted(() => { if (chartData.value) renderChart(); });

onBeforeUnmount(() => { if (chartInstance) chartInstance.destroy(); });
</script>

<style scoped>
.dialogs-packs-chart {
  position: relative;
  height: 300px;
  width: 100%;
}
.chart-loading,
.chart-error,
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}
.chart-error {
  color: #d32f2f;
}
</style>
