import { ref } from 'vue';
import { getControlApiUrl } from '@/shared/lib/utils/url';

export interface EventsUpdatesStats {
  dates: string[];
  events: number[];
  updates: number[];
}

export interface ApiRequestsStats {
  dates: string[];
  requests2xx3xx: number[];
  requests4xx5xx: number[];
}

export function useActivityStats() {
  const loadingEventsUpdates = ref(false);
  const loadingApiRequests = ref(false);
  const eventsUpdatesError = ref<string | null>(null);
  const apiRequestsError = ref<string | null>(null);
  
  const eventsUpdatesStats = ref<EventsUpdatesStats | null>(null);
  const apiRequestsStats = ref<ApiRequestsStats | null>(null);

  async function loadEventsUpdatesStats(): Promise<void> {
    try {
      loadingEventsUpdates.value = true;
      eventsUpdatesError.value = null;
      
      const url = getControlApiUrl('/api/activity/events-updates');
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      eventsUpdatesStats.value = result.data;
    } catch (error: any) {
      console.error('Error loading events-updates stats:', error);
      eventsUpdatesError.value = error.message || 'Failed to load events-updates statistics';
    } finally {
      loadingEventsUpdates.value = false;
    }
  }

  async function loadApiRequestsStats(): Promise<void> {
    try {
      loadingApiRequests.value = true;
      apiRequestsError.value = null;
      
      const url = getControlApiUrl('/api/activity/api-requests');
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      apiRequestsStats.value = result.data;
    } catch (error: any) {
      console.error('Error loading api-requests stats:', error);
      apiRequestsError.value = error.message || 'Failed to load api-requests statistics';
    } finally {
      loadingApiRequests.value = false;
    }
  }

  async function loadAllStats(): Promise<void> {
    await Promise.all([
      loadEventsUpdatesStats(),
      loadApiRequestsStats()
    ]);
  }

  return {
    // State
    loadingEventsUpdates,
    loadingApiRequests,
    eventsUpdatesError,
    apiRequestsError,
    eventsUpdatesStats,
    apiRequestsStats,
    
    // Methods
    loadEventsUpdatesStats,
    loadApiRequestsStats,
    loadAllStats
  };
}
