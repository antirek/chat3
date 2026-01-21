/**
 * Handler для установки статуса сообщения
 */
import * as grpc from '@grpc/grpc-js';
import axios from 'axios';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { mapHttpStatusToGrpc, logError } from '../utils/errorMapper.js';
import { convertToGrpcMessage, convertToGrpcMessageStatus } from '../utils/converter.js';

export async function setMessageStatusHandler(
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
      logError('setMessageStatus: missing userId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    if (!tenantId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'x-tenant-id is required in metadata'
      };
      logError('setMessageStatus: missing tenantId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    // Получаем параметры запроса
    const request = call.request;
    const dialogId = request.dialog_id;
    const messageId = request.message_id;
    const status = request.status;

    if (!dialogId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'dialog_id is required'
      };
      logError('setMessageStatus: missing dialogId', error, { request });
      callback(error);
      return;
    }

    if (!messageId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'message_id is required'
      };
      logError('setMessageStatus: missing messageId', error, { request });
      callback(error);
      return;
    }

    if (!status) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'status is required'
      };
      logError('setMessageStatus: missing status', error, { request });
      callback(error);
      return;
    }

    // Валидация статуса
    const validStatuses = ['unread', 'delivered', 'read'];
    if (!validStatuses.includes(status)) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      };
      logError('setMessageStatus: invalid status', error, { status, validStatuses });
      callback(error);
      return;
    }

    // Вызываем tenant-api напрямую через HTTP, так как Chat3Client имеет несоответствие типов
    // tenant-api принимает 'unread' | 'delivered' | 'read', а Chat3Client использует 'sent' | 'delivered' | 'read'
    // Используем axios напрямую для обхода проблемы с типами
    const baseURL = (tenantApiClient as any).client.defaults.baseURL;
    const apiKey = (tenantApiClient as any).client.defaults.headers['X-API-Key'];
    const tenantIdHeader = (tenantApiClient as any).client.defaults.headers['X-Tenant-ID'];
    
    const response = await axios.post(
      `${baseURL}/api/users/${userId}/dialogs/${dialogId}/messages/${messageId}/status/${status}`,
      {},
      {
        headers: {
          'X-API-Key': apiKey,
          'X-Tenant-ID': tenantIdHeader
        }
      }
    );

    // Преобразуем ответ в gRPC формат
    const responseData = response.data?.data || response.data;
    const statusData = responseData?.status || responseData;
    const messageData = responseData?.message;

    callback(null, {
      status: statusData ? convertToGrpcMessageStatus(statusData) : undefined,
      message: messageData ? convertToGrpcMessage(messageData) : undefined
    });
  } catch (error: any) {
    const httpStatus = error.response?.status || 500;
    const grpcStatus = mapHttpStatusToGrpc(httpStatus);
    const message = error.response?.data?.message || error.message || 'Internal server error';

    logError('setMessageStatus error', error, {
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
