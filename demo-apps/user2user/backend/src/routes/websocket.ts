import { WebSocketServer, WebSocket } from 'ws';
import { grpcClientService } from '../services/grpcClient.js';
import { grpcUpdateToJson } from '../utils/converter.js';

/**
 * WebSocket server для streaming updates через gRPC
 */
export function setupWebSocketServer(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('[WebSocket] New connection, url:', req.url);

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    
    // Получаем userId из пути /ws/updates/:userId или из query
    let userId = url.pathname.split('/').pop();
    if (userId === 'updates' || !userId) {
      // Если userId нет в пути, получаем из query
      userId = url.searchParams.get('userId') || '';
    }

    // Получаем параметры из query string
    const apiKey = url.searchParams.get('apiKey');
    const tenantId = url.searchParams.get('tenantId');

    console.log('[WebSocket] Params:', { userId, apiKey: apiKey?.substring(0, 10) + '...', tenantId });

    if (!userId || !apiKey || !tenantId) {
      console.error('[WebSocket] Missing required params:', { userId: !!userId, apiKey: !!apiKey, tenantId: !!tenantId });
      ws.close(1008, 'Missing required params: userId, apiKey, tenantId');
      return;
    }

    console.log(`[WebSocket] Connecting user: ${userId}, tenant: ${tenantId}`);

    // Получаем gRPC клиент
    let client: any;
    let unsubscribe: (() => void) | null = null;

    try {
      client = grpcClientService.getClient(apiKey, tenantId, userId);

      // Подписываемся на обновления через gRPC stream
      unsubscribe = client.subscribeUpdates((update: any) => {
        try {
          // Конвертируем gRPC Update в JSON
          const jsonUpdate = grpcUpdateToJson(update);

          // Отправляем через WebSocket
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(jsonUpdate));
          }
        } catch (error: any) {
          console.error('[WebSocket] Error processing update:', error);
        }
      });

      console.log(`[WebSocket] Subscribed to updates for user: ${userId}`);
    } catch (error: any) {
      console.error('[WebSocket] Error setting up subscription:', error);
      ws.close(1011, 'Error setting up subscription');
      return;
    }

    // Обработка закрытия соединения
    ws.on('close', () => {
      console.log(`[WebSocket] Connection closed for user: ${userId}`);
      if (unsubscribe) {
        unsubscribe();
      }
    });

    // Обработка ошибок
    ws.on('error', (error) => {
      console.error(`[WebSocket] Error for user ${userId}:`, error);
      if (unsubscribe) {
        unsubscribe();
      }
    });

    // Отправка ping для поддержания соединения
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
        if (unsubscribe) {
          unsubscribe();
        }
      }
    }, 30000); // Ping каждые 30 секунд

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });
}
