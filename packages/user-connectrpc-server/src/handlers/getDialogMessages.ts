/**
 * Handler для получения сообщений диалога (ConnectRPC)
 */
import { Code, ConnectError } from '@connectrpc/connect';
import type { HandlerContext } from '@connectrpc/connect';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { GetDialogMessagesRequest, GetDialogMessagesResponse, Pagination } from '../generated/chat3_user_pb.js';
import { mapHttpStatusToConnect, logError } from '../utils/errorMapper.js';
import { convertToConnectMessage } from '../utils/converter.js';

export async function getDialogMessagesHandler(
  request: GetDialogMessagesRequest,
  context: HandlerContext
): Promise<GetDialogMessagesResponse> {
  try {
    // Извлекаем headers из context
    const headers = context.requestHeader;
    const userId = headers.get('x-user-id') || '';
    const tenantId = headers.get('x-tenant-id') || '';
    const apiKey = headers.get('x-api-key') || '';

    if (!userId) {
      logError('getDialogMessages: missing userId', null, { headers: Object.fromEntries(headers.entries()) });
      throw new ConnectError('x-user-id is required in headers', Code.InvalidArgument);
    }

    if (!tenantId) {
      logError('getDialogMessages: missing tenantId', null, { headers: Object.fromEntries(headers.entries()) });
      throw new ConnectError('x-tenant-id is required in headers', Code.InvalidArgument);
    }

    if (!request.dialogId) {
      logError('getDialogMessages: missing dialogId', null, { request });
      throw new ConnectError('dialogId is required', Code.InvalidArgument);
    }

    // Создаем клиент для tenant-api
    const tenantApiClient = new Chat3Client({
      baseURL: process.env.TENANT_API_URL || 'http://localhost:3000',
      apiKey: apiKey,
      tenantId: tenantId
    });

    const page = request.page || 1;
    const limit = request.limit || 10;

    // Вызываем tenant-api (используем getUserDialogMessages для контекста пользователя)
    const response = await tenantApiClient.getUserDialogMessages(userId, request.dialogId, {
      page,
      limit,
      filter: request.filter,
      sort: request.sort
    });

    // Преобразуем ответ в ConnectRPC формат
    const messages = (response.data || []).map(convertToConnectMessage);
    const pagination = response.pagination || {
      page,
      limit,
      total: 0,
      pages: 0
    };

    return new GetDialogMessagesResponse({
      messages,
      pagination: new Pagination({
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: pagination.pages
      })
    });
  } catch (err: any) {
    // Если это уже ConnectError, пробрасываем дальше
    if (err instanceof ConnectError) {
      throw err;
    }

    const httpStatus = err.response?.status || 500;
    const connectStatus = mapHttpStatusToConnect(httpStatus);
    const message = err.response?.data?.message || err.message || 'Internal server error';

    logError('getDialogMessages error', err, {
      httpStatus,
      connectStatus,
      message
    });

    const connectErr = new ConnectError(message, connectStatus);
    connectErr.metadata.set('http-status', httpStatus.toString());
    throw connectErr;
  }
}
