/**
 * Handler для отправки сообщения
 */
import * as grpc from '@grpc/grpc-js';
import { TenantApiClient } from '../services/tenantApiClient.js';
import { mapHttpStatusToGrpc, logError } from '../utils/errorMapper.js';
import { convertToGrpcMessage } from '../utils/converter.js';

export async function sendMessageHandler(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
  tenantApiClient: TenantApiClient
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

    // Вызываем tenant-api
    const response = await tenantApiClient.sendMessage(dialogId, {
      senderId,
      content,
      type: request.type || 'internal.text',
      meta,
      idempotencyKey: request.idempotency_key
    });

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
