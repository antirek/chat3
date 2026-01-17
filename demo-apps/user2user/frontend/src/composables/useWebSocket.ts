import { ref, onUnmounted } from 'vue';
import type { Update } from '../types/index.js';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || (typeof window !== 'undefined' ? 
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : 
  'ws://localhost:4000');

export function useWebSocket(apiKey: string | { value: string }, tenantId: string | { value: string }, userId: string | { value: string }) {
  const getApiKey = () => typeof apiKey === 'string' ? apiKey : apiKey.value;
  const getTenantId = () => typeof tenantId === 'string' ? tenantId : tenantId.value;
  const getUserId = () => typeof userId === 'string' ? userId : userId.value;
  const ws = ref<WebSocket | null>(null);
  const connected = ref(false);
  const updates = ref<Update[]>([]);
  const error = ref<string | null>(null);

  const connect = () => {
    const key = getApiKey();
    const tenant = getTenantId();
    const user = getUserId();
    
    if (!key || !tenant || !user) {
      error.value = 'Missing required params: apiKey, tenantId, userId';
      return;
    }

    const wsUrl = `${WS_BASE_URL}/ws/updates/${user}?apiKey=${encodeURIComponent(key)}&tenantId=${encodeURIComponent(tenant)}`;
    
    try {
      const websocket = new WebSocket(wsUrl);
      ws.value = websocket;

      websocket.onopen = () => {
        console.log(`[WebSocket] Connected for user: ${user}`);
        connected.value = true;
        error.value = null;
      };

      websocket.onmessage = (event) => {
        try {
          const update: Update = JSON.parse(event.data);
          updates.value.push(update);
          console.log(`[WebSocket] Update received:`, update);
        } catch (err) {
          console.error('[WebSocket] Error parsing update:', err);
        }
      };

      websocket.onerror = (err) => {
        console.error(`[WebSocket] Error for user ${user}:`, err);
        error.value = 'WebSocket connection error';
      };

      websocket.onclose = () => {
        console.log(`[WebSocket] Disconnected for user: ${user}`);
        connected.value = false;
      };
    } catch (err) {
      console.error('[WebSocket] Connection error:', err);
      error.value = 'Failed to connect WebSocket';
    }
  };

  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
      connected.value = false;
    }
  };

  const clearUpdates = () => {
    updates.value = [];
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    ws,
    connected,
    updates,
    error,
    connect,
    disconnect,
    clearUpdates,
  };
}
