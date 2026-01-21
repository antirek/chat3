/**
 * Handler для отправки индикатора печати
 */
import * as grpc from '@grpc/grpc-js';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { mapHttpStatusToGrpc, logError } from '../utils/errorMapper.js';

export async function sendTypingIndicatorHandler(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
  tenantApiClient: Chat3Client
): Promise<void> {
  try {
    // Извлекаем метаданные
    const metadata = call.metadata;
    const userId = metadata.get('x-user-id')[0] as string;
    const tenantId = metadata.get('x-tenant-id')[0] as string;

    if (!userId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'x-user-id is required in metadata'
      };
      logError('sendTypingIndicator: missing userId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    if (!tenantId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'x-tenant-id is required in metadata'
      };
      logError('sendTypingIndicator: missing tenantId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    // Получаем параметры запроса
    const request = call.request;
    const dialogId = request.dialog_id;

    if (!dialogId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'dialog_id is required'
      };
      logError('sendTypingIndicator: missing dialogId', error, { request });
      callback(error);
      return;
    }

    // Вызываем tenant-api
    const response = await tenantApiClient.sendTypingSignal(dialogId, userId);

    // Извлекаем данные из ответа
    const responseData = response.data?.data || response.data;
    const expiresInMs = responseData?.expiresInMs || 5000; // По умолчанию 5 секунд

    callback(null, {
      message: response.data?.message || 'Typing signal accepted',
      dialog_id: dialogId,
      expires_in_ms: expiresInMs
    });
  } catch (error: any) {
    const httpStatus = error.response?.status || error.status || 500;
    const grpcStatus = mapHttpStatusToGrpc(httpStatus);
    const message = error.response?.data?.message || error.message || 'Internal server error';

    logError('sendTypingIndicator error', error, {
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
