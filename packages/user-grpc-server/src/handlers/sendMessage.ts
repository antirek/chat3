/**
 * Handler для отправки сообщения
 */
import * as grpc from '@grpc/grpc-js';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { mapHttpStatusToGrpc, logError } from '../utils/errorMapper.js';
import { convertToGrpcMessage } from '../utils/converter.js';

export async function sendMessageHandler(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
  tenantApiClient: Chat3Client
): Promise<void> {
  try {
    // Извлекаем метаданные
    const metadata = call.metadata;
    const tenantId = metadata.get('x-tenant-id')[0] as string;

    if (!tenantId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'x-tenant-id is required in metadata'
      };
      logError('sendMessage: missing tenantId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    // Получаем параметры запроса
    const request = call.request;
    const dialogId = request.dialog_id;
    const senderId = request.sender_id;
    const content = request.content;

    if (!dialogId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'dialog_id is required'
      };
      logError('sendMessage: missing dialogId', error, { request });
      callback(error);
      return;
    }

    if (!senderId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'sender_id is required'
      };
      logError('sendMessage: missing senderId', error, { request });
      callback(error);
      return;
    }

    if (!content) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'content is required'
      };
      logError('sendMessage: missing content', error, { request });
      callback(error);
      return;
    }

    // Преобразуем Struct в обычный объект для tenant-api
    const meta = request.meta ? JSON.parse(JSON.stringify(request.meta)) : undefined;

    // Вызываем tenant-api (используем createMessage)
    const data: Record<string, any> = {
      senderId,
      content,
      type: request.type || 'internal.text',
      ...(meta && { meta })
    };

    // TODO: Добавить поддержку idempotency key в Chat3Client или через interceptor
    // Для idempotency key нужно использовать заголовки, но Chat3Client пока не поддерживает это напрямую
    const response = await tenantApiClient.createMessage(dialogId, data);

    // Преобразуем ответ в gRPC формат
    const message = convertToGrpcMessage(response.data);

    callback(null, {
      message
    });
  } catch (error: any) {
    const httpStatus = error.response?.status || 500;
    const grpcStatus = mapHttpStatusToGrpc(httpStatus);
    const message = error.response?.data?.message || error.message || 'Internal server error';

    logError('sendMessage error', error, {
      httpStatus,
      grpcStatus,
      message
    });

    callback({
      code: grpcStatus,
      message,
      details: error.response?.data?.error || error.message
    });
  }
}
