/**
 * Handler для установки/снятия реакции на сообщение
 */
import * as grpc from '@grpc/grpc-js';
import { Chat3Client } from '@chottodev/chat3-tenant-api-client';
import { mapHttpStatusToGrpc, logError } from '../utils/errorMapper.js';

export async function setMessageReactionHandler(
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
      logError('setMessageReaction: missing userId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    if (!tenantId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'x-tenant-id is required in metadata'
      };
      logError('setMessageReaction: missing tenantId', error, { metadata: metadata.getMap() });
      callback(error);
      return;
    }

    // Получаем параметры запроса
    const request = call.request;
    const dialogId = request.dialog_id;
    const messageId = request.message_id;
    const reaction = request.reaction;
    const set = request.set !== undefined ? request.set : true; // По умолчанию set=true

    if (!dialogId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'dialog_id is required'
      };
      logError('setMessageReaction: missing dialogId', error, { request });
      callback(error);
      return;
    }

    if (!messageId) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'message_id is required'
      };
      logError('setMessageReaction: missing messageId', error, { request });
      callback(error);
      return;
    }

    if (!reaction) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'reaction is required'
      };
      logError('setMessageReaction: missing reaction', error, { request });
      callback(error);
      return;
    }

    // Валидация реакции
    if (typeof reaction !== 'string' || reaction.trim().length === 0) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'reaction must be a non-empty string'
      };
      logError('setMessageReaction: invalid reaction', error, { reaction });
      callback(error);
      return;
    }

    if (reaction.length > 50) {
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        message: 'reaction is too long (maximum 50 characters)'
      };
      logError('setMessageReaction: reaction too long', error, { reaction, length: reaction.length });
      callback(error);
      return;
    }

    // Определяем действие: 'set' или 'unset'
    const action = set ? 'set' : 'unset';

    // Вызываем tenant-api
    const response = await tenantApiClient.setReaction(
      userId,
      dialogId,
      messageId,
      action,
      reaction
    );

    // Преобразуем reactionSet в Struct формат, если он есть
    const reactionSet = response.data?.reactionSet || response.data?.data?.reactionSet;

    callback(null, {
      message: response.message || (set ? 'Reaction set successfully' : 'Reaction unset successfully'),
      reaction_set: reactionSet || undefined
    });
  } catch (error: any) {
    const httpStatus = error.response?.status || 500;
    const grpcStatus = mapHttpStatusToGrpc(httpStatus);
    const message = error.response?.data?.message || error.message || 'Internal server error';

    logError('setMessageReaction error', error, {
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
