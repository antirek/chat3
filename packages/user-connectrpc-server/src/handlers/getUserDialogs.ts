/**
 * Handler для получения диалогов пользователя (ConnectRPC)
 */
import { Code, ConnectError } from '@connectrpc/connect';
import type { HandlerContext } from '@connectrpc/connect';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { GetUserDialogsRequest, GetUserDialogsResponse, Pagination, Dialog } from '../generated/chat3_user_pb.js';
import { mapHttpStatusToConnect, logError } from '../utils/errorMapper.js';
import { convertToConnectDialog } from '../utils/converter.js';

export async function getUserDialogsHandler(
  request: GetUserDialogsRequest,
  context: HandlerContext
): Promise<GetUserDialogsResponse> {
  try {
    // Извлекаем headers из context
    const headers = context.requestHeader;
    const userId = headers.get('x-user-id') || '';
    const tenantId = headers.get('x-tenant-id') || '';
    const apiKey = headers.get('x-api-key') || '';

    if (!userId) {
      logError('getUserDialogs: missing userId', null, { headers: Object.fromEntries(headers.entries()) });
      throw new ConnectError('x-user-id is required in headers', Code.InvalidArgument);
    }

    if (!tenantId) {
      logError('getUserDialogs: missing tenantId', null, { headers: Object.fromEntries(headers.entries()) });
      throw new ConnectError('x-tenant-id is required in headers', Code.InvalidArgument);
    }

    // Создаем клиент для tenant-api
    const tenantApiClient = new Chat3Client({
      baseURL: process.env.TENANT_API_URL || 'http://localhost:3000',
      apiKey: apiKey,
      tenantId: tenantId
    });

    // Получаем параметры запроса
    const page = request.page || 1;
    const limit = request.limit || 10;

    // Вызываем tenant-api
    const response = await tenantApiClient.getUserDialogs(userId, {
      page,
      limit,
      filter: request.filter,
      sort: request.sort,
      includeLastMessage: request.includeLastMessage
    });

    // Преобразуем ответ в ConnectRPC формат
    // Protobuf-ES v1 конструкторы принимают PartialMessage, поэтому простые объекты должны работать
    const dialogsData = (response.data || []).map(convertToConnectDialog);
    
    // Создаем Dialog объекты через конструкторы классов
    const dialogs = dialogsData.map(d => {
      try {
        const dialog = new Dialog(d);
        // Проверяем, что lastMessage создан правильно
        if (dialog.lastMessage) {
          // Убеждаемся, что createdAt имеет тип number
          if (typeof (dialog.lastMessage as any).createdAt !== 'number') {
            console.error('[getUserDialogs] lastMessage.createdAt is not a number:', typeof (dialog.lastMessage as any).createdAt, (dialog.lastMessage as any).createdAt);
          }
        }
        return dialog;
      } catch (error: any) {
        console.error('[getUserDialogs] Error creating Dialog:', error, d);
        throw error;
      }
    });
    
    const pagination = response.pagination || {
      page,
      limit,
      total: 0,
      pages: 0
    };

    // В Protobuf-ES v1 используем классы для создания сообщений
    const result = new GetUserDialogsResponse({
      dialogs,
      pagination: new Pagination({
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: pagination.pages
      })
    });

    // Проверяем, что ответ можно сериализовать в JSON (для отладки)
    try {
      const testJson = result.toJson();
      console.log('[getUserDialogs] Response can be serialized to JSON, dialogs count:', dialogs.length);
    } catch (error: any) {
      console.error('[getUserDialogs] Error serializing response to JSON:', error);
      throw error;
    }

    return result;
  } catch (err: any) {
    // Если это уже ConnectError, пробрасываем дальше
    if (err instanceof ConnectError) {
      throw err;
    }

    const httpStatus = err.response?.status || 500;
    const connectStatus = mapHttpStatusToConnect(httpStatus);
    const message = err.response?.data?.message || err.message || 'Internal server error';

    logError('getUserDialogs error', err, {
      httpStatus,
      connectStatus,
      message
    });

    const connectErr = new ConnectError(message, connectStatus);
    connectErr.metadata.set('http-status', httpStatus.toString());
    throw connectErr;
  }
}
