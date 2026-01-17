/**
 * Handler для получения диалогов пользователя
 */
import * as grpc from '@grpc/grpc-js';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { mapHttpStatusToGrpc, logError } from '../utils/errorMapper.js';
import { convertToGrpcDialog } from '../utils/converter.js';

export async function getUserDialogsHandler(
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
      logError('getUserDialogs: missing userId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    if (!tenantId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'x-tenant-id is required in metadata'
      };
      logError('getUserDialogs: missing tenantId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    // Получаем параметры запроса
    const request = call.request;
    const page = request.page || 1;
    const limit = request.limit || 10;

    // Вызываем tenant-api
    const response = await tenantApiClient.getUserDialogs(userId, {
      page,
      limit,
      filter: request.filter,
      sort: request.sort,
      includeLastMessage: request.include_last_message
    });

    // Преобразуем ответ в gRPC формат
    const dialogs = (response.data || []).map(convertToGrpcDialog);
    const pagination = response.pagination || {
      page,
      limit,
      total: 0,
      pages: 0
    };

    callback(null, {
      dialogs,
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

    logError('getUserDialogs error', error, {
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
