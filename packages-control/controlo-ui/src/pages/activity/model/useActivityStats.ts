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

export interface DialogsPacksStats {
  dates: string[];
  dialogs: number[];
  packs: number[];
}

export interface MessagesStats {
  dates: string[];
  messages: number[];
}

export function useActivityStats() {
  const loadingEventsUpdates = ref(false);
  const loadingApiRequests = ref(false);
  const loadingDialogsPacks = ref(false);
  const loadingMessages = ref(false);
  const eventsUpdatesError = ref<string | null>(null);
  const apiRequestsError = ref<string | null>(null);
  const dialogsPacksError = ref<string | null>(null);
  const messagesError = ref<string | null>(null);
  
  const eventsUpdatesStats = ref<EventsUpdatesStats | null>(null);
  const apiRequestsStats = ref<ApiRequestsStats | null>(null);
  const dialogsPacksStats = ref<DialogsPacksStats | null>(null);
  const messagesStats = ref<MessagesStats | null>(null);

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

  async function loadDialogsPacksStats(): Promise<void> {
    try {
      loadingDialogsPacks.value = true;
      dialogsPacksError.value = null;
      const url = getControlApiUrl('/api/activity/dialogs-packs');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      dialogsPacksStats.value = result.data;
    } catch (error: any) {
      console.error('Error loading dialogs-packs stats:', error);
      dialogsPacksError.value = error.message || 'Failed to load dialogs-packs statistics';
    } finally {
      loadingDialogsPacks.value = false;
    }
  }

  async function loadMessagesStats(): Promise<void> {
    try {
      loadingMessages.value = true;
      messagesError.value = null;
      const url = getControlApiUrl('/api/activity/messages');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      messagesStats.value = result.data;
    } catch (error: any) {
      console.error('Error loading messages stats:', error);
      messagesError.value = error.message || 'Failed to load messages statistics';
    } finally {
      loadingMessages.value = false;
    }
  }

  async function loadAllStats(): Promise<void> {
    await loadEventsUpdatesStats();
    await loadApiRequestsStats();
    await loadDialogsPacksStats();
    await loadMessagesStats();
  }

  return {
    // State
    loadingEventsUpdates,
    loadingApiRequests,
    loadingDialogsPacks,
    loadingMessages,
    eventsUpdatesError,
    apiRequestsError,
    dialogsPacksError,
    messagesError,
    eventsUpdatesStats,
    apiRequestsStats,
    dialogsPacksStats,
    messagesStats,
    // Methods
    loadEventsUpdatesStats,
    loadApiRequestsStats,
    loadDialogsPacksStats,
    loadMessagesStats,
    loadAllStats
  };
}
