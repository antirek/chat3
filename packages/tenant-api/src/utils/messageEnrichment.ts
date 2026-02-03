import { User } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import { buildStatusMessageMatrix, buildReactionSet } from '@chat3/utils/userDialogUtils.js';

type SenderInfo = {
  userId: string;
  createdAt: number | null;
  meta: Record<string, unknown>;
} | null;

export async function getSenderInfo(
  tenantId: string,
  senderId: string | null | undefined,
  cache: Map<string, SenderInfo> = new Map()
): Promise<SenderInfo> {
  if (!senderId) {
    return null;
  }

  if (cache.has(senderId)) {
    return cache.get(senderId)!;
  }

  const user = await User.findOne({
    tenantId,
    userId: senderId
  })
    .select('userId name createdAt')
    .lean();

  if (!user) {
    cache.set(senderId, null);
    return null;
  }

  const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', senderId);

  const senderInfo: SenderInfo = {
    userId: user.userId,
    createdAt: user.createdAt ?? null,
    meta: userMeta
  };

  cache.set(senderId, senderInfo);
  return senderInfo;
}

interface EnrichOptions {
  dialogId?: string | null;
}

export async function enrichMessagesWithMetaAndStatuses(
  messages: any[],
  tenantId: string,
  options: EnrichOptions = {}
): Promise<any[]> {
  const senderInfoCache = new Map<string, SenderInfo>();

  const singleDialogId = options.dialogId ?? null;

  // Collect topic ids grouped by dialog
  const topicsByDialog = new Map<string, Set<string>>();
  messages.forEach((msg) => {
    const messageObj = msg.toObject ? msg.toObject() : msg;
    const dialogId: string | undefined = singleDialogId ?? messageObj.dialogId;
    const topicId: string | undefined = messageObj.topicId;

    if (dialogId && topicId) {
      if (!topicsByDialog.has(dialogId)) {
        topicsByDialog.set(dialogId, new Set());
      }
      topicsByDialog.get(dialogId)!.add(topicId);
    }
  });

  const topicsCache = new Map<string, Map<string, { topicId: string; meta: Record<string, unknown> }>>();
  for (const [dialogId, topicIdSet] of topicsByDialog.entries()) {
    try {
      const topicsMap = await topicUtils.getTopicsWithMetaBatch(tenantId, dialogId, Array.from(topicIdSet));
      topicsCache.set(dialogId, topicsMap);
    } catch (error) {
      console.error('Error loading topics for dialog', dialogId, error);
      topicsCache.set(dialogId, new Map());
    }
  }

  return Promise.all(
    messages.map(async (message) => {
      const messageObj = message.toObject ? message.toObject() : message;
      const dialogId: string | undefined = singleDialogId ?? messageObj.dialogId;

      const meta = await metaUtils.getEntityMeta(
        tenantId,
        'message',
        messageObj.messageId
      );

      let topic = null;
      if (dialogId && messageObj.topicId) {
        const dialogTopicCache = topicsCache.get(dialogId);
        topic = dialogTopicCache?.get(messageObj.topicId) || null;
      }

      const statusMessageMatrix = await buildStatusMessageMatrix(
        tenantId,
        messageObj.messageId,
        messageObj.senderId
      );

      const reactionSet = await buildReactionSet(
        tenantId,
        messageObj.messageId,
        null
      );

      const senderInfo = await getSenderInfo(tenantId, messageObj.senderId, senderInfoCache);

      return {
        ...messageObj,
        meta,
        topic,
        statusMessageMatrix,
        reactionSet,
        senderInfo: senderInfo || null
      };
    })
  );
}
