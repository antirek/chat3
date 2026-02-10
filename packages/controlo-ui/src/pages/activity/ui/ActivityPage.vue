<template>
  <div class="activity-page">
    <div class="container">
      <h1 class="page-title">Активность</h1>
      
      <!-- График Events & Updates -->
      <div class="chart-panel">
        <div class="chart-header">
          <h2>Events & Updates</h2>
        </div>
        <EventsUpdatesChart
          :dates="eventsUpdatesStats?.dates || []"
          :events="eventsUpdatesStats?.events || []"
          :updates="eventsUpdatesStats?.updates || []"
          :loading="loadingEventsUpdates"
          :error="eventsUpdatesError"
        />
      </div>

      <!-- График API запросов -->
      <div class="chart-panel">
        <div class="chart-header">
          <h2>API запросы</h2>
        </div>
        <ApiRequestsChart
          :dates="apiRequestsStats?.dates || []"
          :requests2xx3xx="apiRequestsStats?.requests2xx3xx || []"
          :requests4xx5xx="apiRequestsStats?.requests4xx5xx || []"
          :loading="loadingApiRequests"
          :error="apiRequestsError"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useActivityStats } from '../model/useActivityStats';
import EventsUpdatesChart from './charts/EventsUpdatesChart.vue';
import ApiRequestsChart from './charts/ApiRequestsChart.vue';

const {
  loadingEventsUpdates,
  loadingApiRequests,
  eventsUpdatesError,
  apiRequestsError,
  eventsUpdatesStats,
  apiRequestsStats,
  loadAllStats
} = useActivityStats();

onMounted(() => {
  loadAllStats();
});
</script>

<style scoped>
.activity-page {
  padding: 20px;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #333;
}

.chart-panel {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-header {
  margin-bottom: 20px;
}

.chart-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}
</style>
