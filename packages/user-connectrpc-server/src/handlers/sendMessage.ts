/**
 * Handler для отправки сообщения (ConnectRPC)
 */
import { Code, ConnectError } from '@connectrpc/connect';
import type { HandlerContext } from '@connectrpc/connect';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { SendMessageRequest, SendMessageResponse } from '../generated/chat3_user_pb.js';
import { mapHttpStatusToConnect, logError } from '../utils/errorMapper.js';
import { convertToConnectMessage } from '../utils/converter.js';

export async function sendMessageHandler(
  request: SendMessageRequest,
  context: HandlerContext
): Promise<SendMessageResponse> {
  try {
    // Извлекаем headers из context
    const headers = context.requestHeader;
    const tenantId = headers.get('x-tenant-id') || '';
    const apiKey = headers.get('x-api-key') || '';

    if (!tenantId) {
      logError('sendMessage: missing tenantId', null, { headers: Object.fromEntries(headers.entries()) });
      throw new ConnectError('x-tenant-id is required in headers', Code.InvalidArgument);
    }

    if (!request.dialogId) {
      logError('sendMessage: missing dialogId', null, { request });
      throw new ConnectError('dialogId is required', Code.InvalidArgument);
    }

    if (!request.senderId) {
      logError('sendMessage: missing senderId', null, { request });
      throw new ConnectError('senderId is required', Code.InvalidArgument);
    }

    if (!request.content) {
      logError('sendMessage: missing content', null, { request });
      throw new ConnectError('content is required', Code.InvalidArgument);
    }

    // Создаем клиент для tenant-api
    const tenantApiClient = new Chat3Client({
      baseURL: process.env.TENANT_API_URL || 'http://localhost:3000',
      apiKey: apiKey,
      tenantId: tenantId
    });

    // Преобразуем Struct в обычный объект для tenant-api
    const meta = request.meta ? JSON.parse(JSON.stringify(request.meta)) : undefined;

    // Вызываем tenant-api (используем createMessage)
    const data: Record<string, any> = {
      senderId: request.senderId,
      content: request.content,
      type: request.type || 'internal.text',
      ...(meta && { meta })
    };

    const response = await tenantApiClient.createMessage(request.dialogId, data);

    // Преобразуем ответ в ConnectRPC формат
    const message = convertToConnectMessage(response.data);

    return new SendMessageResponse({
      message
    });
  } catch (err: any) {
    // Если это уже ConnectError, пробрасываем дальше
    if (err instanceof ConnectError) {
      throw err;
    }

    const httpStatus = err.response?.status || 500;
    const connectStatus = mapHttpStatusToConnect(httpStatus);
    const message = err.response?.data?.message || err.message || 'Internal server error';

    logError('sendMessage error', err, {
      httpStatus,
      connectStatus,
      message
    });

    const connectErr = new ConnectError(message, connectStatus);
    connectErr.metadata.set('http-status', httpStatus.toString());
    throw connectErr;
  }
}
