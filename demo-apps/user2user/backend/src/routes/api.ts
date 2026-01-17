import { Router, Request, Response } from 'express';
import axios from 'axios';
import { grpcClientService } from '../services/grpcClient.js';
import { grpcMessageToJson, grpcDialogToJson, jsonToStruct } from '../utils/converter.js';
import { config } from '../config/index.js';

const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';

const router = Router();

/**
 * GET /api/config - Конфигурация для фронтенда
 */
router.get('/config', (req: Request, res: Response) => {
  res.json({
    grpcServerUrl: config.grpcServerUrl,
    tenantId: config.tenantId,
  });
});

/**
 * GET /api/dialogs - Получить список диалогов пользователя
 */
router.get('/dialogs', async (req: Request, res: Response) => {
  try {
    console.log('[API] GET /api/dialogs request:', req.query);
    const { apiKey, tenantId, userId } = req.query;

    if (!apiKey || !tenantId || !userId) {
      return res.status(400).json({ error: 'Missing required query params: apiKey, tenantId, userId' });
    }

    const client = grpcClientService.getClient(String(apiKey), String(tenantId), String(userId));
    const response = await client.getUserDialogs({ limit: 100 });
    
    console.log(`[API] GET /api/dialogs: found ${response.dialogs?.length || 0} dialogs for user ${userId}`);
    res.json({
      dialogs: (response.dialogs || []).map(grpcDialogToJson),
    });
  } catch (error: any) {
    console.error('[API] Error getting user dialogs:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/dialogs - Создать/найти диалог между user1 и user2
 */
router.post('/dialogs', async (req: Request, res: Response) => {
  try {
    console.log('[API] POST /api/dialogs request:', { body: req.body });
    const { apiKey, tenantId, user1, user2 } = req.body;

    if (!apiKey || !tenantId || !user1 || !user2) {
      console.log('[API] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: apiKey, tenantId, user1, user2' });
    }

    // Получаем диалоги user1
    const client1 = grpcClientService.getClient(apiKey, tenantId, user1);
    const dialogsResponse = await client1.getUserDialogs({ limit: 100 });

    // Ищем диалог с user2
    // Для демо упростим: проверяем все диалоги пользователя
    // В реальном приложении нужно проверять через members или список участников
    let dialog = null;
    
    console.log(`[API] Searching dialog between ${user1} and ${user2}, found ${dialogsResponse.dialogs?.length || 0} dialogs`);
    
    // Простая проверка: ищем диалог, где есть user2 в каком-то виде
    // Для демо используем простую логику - проверяем имя диалога или member
    if (dialogsResponse.dialogs) {
      for (const d of dialogsResponse.dialogs) {
        const dialogName = d.name || '';
        const memberUserId = d.member?.user_id || '';
        // Проверяем, содержит ли имя диалога user2 или member равен user2
        if (dialogName.includes(user2) || memberUserId === user2) {
          dialog = d;
          console.log(`[API] Found dialog: ${d.dialog_id}`);
          break;
        }
      }
    }

    // Если диалог не найден, пытаемся найти через user2
    if (!dialog) {
      console.log(`[API] Dialog not found for user1, searching in user2 dialogs`);
      const client2 = grpcClientService.getClient(apiKey, tenantId, user2);
      const dialogsResponse2 = await client2.getUserDialogs({ limit: 100 });
      console.log(`[API] User2 has ${dialogsResponse2.dialogs?.length || 0} dialogs`);
      
      if (dialogsResponse2.dialogs) {
        for (const d of dialogsResponse2.dialogs) {
          const dialogName = d.name || '';
          const memberUserId = d.member?.user_id || '';
          if (dialogName.includes(user1) || memberUserId === user1) {
            dialog = d;
            console.log(`[API] Found dialog in user2 dialogs: ${d.dialog_id}`);
            break;
          }
        }
      }
    }

    // Если диалог не найден, создаем через tenant-api
    if (!dialog) {
      try {
        console.log(`[API] Creating dialog between ${user1} and ${user2}`);
        const createDialogResponse = await axios.post(
          `${TENANT_API_URL}/api/dialogs`,
          {
            name: `Dialog ${user1}-${user2}`,
            createdBy: user1,
            members: [
              { userId: user1, type: 'user', name: `User ${user1}` },
              { userId: user2, type: 'user', name: `User ${user2}` },
            ],
          },
          {
            headers: {
              'X-API-Key': apiKey,
              'X-Tenant-ID': tenantId,
              'Content-Type': 'application/json',
            },
          }
        );

        const newDialogId = createDialogResponse.data.data.dialogId;
        console.log(`[API] Dialog created: ${newDialogId}`);

        // Получаем созданный диалог через gRPC
        const dialogsResponse = await client1.getUserDialogs({ limit: 100 });
        dialog = dialogsResponse.dialogs?.find((d: any) => d.dialog_id === newDialogId);

        if (!dialog) {
          // Если диалог еще не появился в gRPC, возвращаем его ID
          return res.json({
            dialog: {
              dialog_id: newDialogId,
              tenant_id: tenantId,
              name: `Dialog ${user1}-${user2}`,
              created_by: user1,
              created_at: Date.now(),
              updated_at: Date.now(),
            },
            created: true,
          });
        }
      } catch (createError: any) {
        console.error('[API] Error creating dialog:', createError.response?.data || createError.message);
        return res.status(500).json({
          error: 'Failed to create dialog',
          details: createError.response?.data?.message || createError.message,
        });
      }
    }

    res.json({
      dialog: grpcDialogToJson(dialog),
      created: false,
    });
  } catch (error: any) {
    console.error('[API] Error creating/finding dialog:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/dialogs/:dialogId - Получить диалог
 * ВАЖНО: Этот роут должен быть ПОСЛЕ GET /api/dialogs, чтобы не перехватывать запросы
 */
router.get('/dialogs/:dialogId', async (req: Request, res: Response) => {
  try {
    const { dialogId } = req.params;
    const { apiKey, tenantId, userId } = req.query;

    if (!apiKey || !tenantId || !userId) {
      return res.status(400).json({ error: 'Missing required query params: apiKey, tenantId, userId' });
    }

    const client = grpcClientService.getClient(String(apiKey), String(tenantId), String(userId));
    const dialogsResponse = await client.getUserDialogs({ limit: 100 });
    
    const dialog = dialogsResponse.dialogs?.find((d: any) => d.dialog_id === dialogId);

    if (!dialog) {
      return res.status(404).json({ error: 'Dialog not found' });
    }

    res.json({ dialog: grpcDialogToJson(dialog) });
  } catch (error: any) {
    console.error('[API] Error getting dialog:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * GET /api/dialogs/:dialogId/messages - Получить сообщения диалога
 */
router.get('/dialogs/:dialogId/messages', async (req: Request, res: Response) => {
  try {
    const { dialogId } = req.params;
    const { apiKey, tenantId, userId, page = '1', limit = '50' } = req.query;

    if (!apiKey || !tenantId || !userId) {
      return res.status(400).json({ error: 'Missing required query params: apiKey, tenantId, userId' });
    }

    const client = grpcClientService.getClient(String(apiKey), String(tenantId), String(userId));
    const response = await client.getDialogMessages(dialogId, {
      page: parseInt(String(page), 10),
      limit: parseInt(String(limit), 10),
    });

    res.json({
      messages: (response.messages || []).map(grpcMessageToJson),
      pagination: response.pagination,
    });
  } catch (error: any) {
    console.error('[API] Error getting messages:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/dialogs/:dialogId/messages - Отправить сообщение
 */
router.post('/dialogs/:dialogId/messages', async (req: Request, res: Response) => {
  try {
    const { dialogId } = req.params;
    const { apiKey, tenantId, senderId, content, type = 'internal.text', meta } = req.body;

    if (!apiKey || !tenantId || !senderId || !content) {
      return res.status(400).json({ error: 'Missing required fields: apiKey, tenantId, senderId, content' });
    }

    const client = grpcClientService.getClient(apiKey, tenantId, senderId);
    const response = await client.sendMessage(dialogId, senderId, {
      content,
      type,
      meta,
    });

    res.json({
      message: grpcMessageToJson(response.message),
    });
  } catch (error: any) {
    console.error('[API] Error sending message:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
