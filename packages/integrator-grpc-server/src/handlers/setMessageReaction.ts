import * as grpc from '@grpc/grpc-js';
import { setMessageReaction, AppServiceError } from '@chat3/app-services';
import type { AuthenticatedContext } from '@chat3/app-services';

export async function setMessageReactionHandler(
  call: grpc.ServerUnaryCall<any, any>,
  auth: AuthenticatedContext
): Promise<any> {
  const userId = call.request.user_id;
  const messageId = call.request.message_id;
  const reaction = call.request.reaction;
  const set = call.request.set !== false;

  if (!userId || !messageId || !reaction) {
    throw new AppServiceError(
      'VALIDATION',
      'user_id, message_id and reaction are required'
    );
  }
  if (!auth.tenantId) {
    throw new AppServiceError('VALIDATION', 'tenantId is required');
  }

  const result = await setMessageReaction({
    tenantId: auth.tenantId,
    userId,
    messageId,
    reaction,
    action: set ? 'set' : 'unset'
  });

  return {
    message: result.message,
    reaction_set: result.reactionSet
  };
}
