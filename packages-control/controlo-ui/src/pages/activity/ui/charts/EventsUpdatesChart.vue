<template>
  <div class="events-updates-chart">
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
  events: number[];
  updates: number[];
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
  if (!props.dates || props.dates.length === 0) {
    return null;
  }
  
  return {
    labels: props.dates,
    datasets: [
      {
        label: 'Events',
        data: props.events,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Updates',
        data: props.updates,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
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
      ticks: {
        maxRotation: 45,
        minRotation: 45
      }
    },
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1
      }
    }
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const
    },
    title: {
      display: true,
      text: 'Events & Updates за последние 30 дней'
    }
  }
};

async function renderChart() {
  await nextTick();
  
  if (!chartCanvas.value || !chartData.value) {
    return;
  }

  // Уничтожаем предыдущий график, если он существует
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    data: chartData.value,
    options: chartOptions
  });
}

watch(() => chartData.value, (newData) => {
  if (newData) {
    renderChart();
  }
}, { deep: true });

onMounted(() => {
  if (chartData.value) {
    renderChart();
  }
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<style scoped>
.events-updates-chart {
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
