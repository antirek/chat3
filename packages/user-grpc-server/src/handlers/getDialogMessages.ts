/**
 * Handler для получения сообщений диалога
 */
import * as grpc from '@grpc/grpc-js';
import { TenantApiClient } from '../services/tenantApiClient.js';
import { mapHttpStatusToGrpc, logError } from '../utils/errorMapper.js';
import { convertToGrpcMessage } from '../utils/converter.js';

export async function getDialogMessagesHandler(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
  tenantApiClient: TenantApiClient
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
      logError('getDialogMessages: missing userId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    if (!tenantId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'x-tenant-id is required in metadata'
      };
      logError('getDialogMessages: missing tenantId', error, { metadata: metadata.getMap() });
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
      logError('getDialogMessages: missing dialogId', error, { request });
      callback(error);
      return;
    }

    const page = request.page || 1;
    const limit = request.limit || 10;

    // Вызываем tenant-api
    const response = await tenantApiClient.getDialogMessages(userId, dialogId, {
      page,
      limit,
      filter: request.filter,
      sort: request.sort
    });

    // Преобразуем ответ в gRPC формат
    const messages = (response.data || []).map(convertToGrpcMessage);
    const pagination = response.pagination || {
      page,
      limit,
      total: 0,
      pages: 0
    };

    callback(null, {
      messages,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: pagination.pages
      }
    });
  } catch (error: any) {
    const httpStatus = error.response?.status || 500;
    const grpcStatus = mapHttpStatusToGrpc(httpStatus);
    const message = error.response?.data?.message || error.message || 'Internal server error';

    logError('getDialogMessages error', error, {
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
