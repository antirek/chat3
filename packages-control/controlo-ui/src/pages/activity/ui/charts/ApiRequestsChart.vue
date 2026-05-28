<template>
  <div class="api-requests-chart">
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
  requests2xx3xx: number[];
  requests4xx5xx: number[];
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
        label: '2XX+3XX',
        data: props.requests2xx3xx,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      },
      {
        label: '4XX+5XX',
        data: props.requests4xx5xx,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
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
      text: 'API запросы по кодам ответа (2XX+3XX / 4XX+5XX)'
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
.api-requests-chart {
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
