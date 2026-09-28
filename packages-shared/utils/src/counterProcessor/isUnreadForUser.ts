/**
 * Непрочитано на полном пересчёте: сообщения после lastSeenAt (readUntil) и не раньше join.
 * system.* и sender исключаются на уровне агрегации Message.
 * Граница join: Message.createdAt >= DialogMember.createdAt.
 * Per-message MessageStatus на этом пути не используется (см. FDR-0004).
 */

export type UnreadMessageMatchOptions = {
  memberJoinedAt?: number;
  /** Watermark: createdAt <= lastSeenAt считается прочитанным. */
  lastSeenAt?: number | null;
};

/** Доп. условия $match для Message при подсчёте unread. */
export function unreadMessageMatchExtras(
  viewerUserId: string,
  options: UnreadMessageMatchOptions = {}
): Record<string, unknown> {
  const uid = (viewerUserId || '').trim().toLowerCase();
  const match: Record<string, unknown> = {
    senderId: { $ne: uid },
    type: { $not: { $regex: /^system\./ } },
    // soft-deleted messages are excluded from unread (missing field = not deleted)
    deleted: { $ne: true }
  };
  if (options.memberJoinedAt != null) {
    const joinedAt = options.memberJoinedAt;
    const lastSeenAt = options.lastSeenAt;
    if (lastSeenAt != null && lastSeenAt >= joinedAt) {
      match.createdAt = { $gt: lastSeenAt };
    } else {
      match.createdAt = { $gte: joinedAt };
    }
  }
  return match;
}

/** Pipeline-фрагмент: lookup на наличие read у viewer. */
export function messageReadLookupPipeline(tenantId: string, viewerUserId: string): Record<string, unknown>[] {
  const uid = (viewerUserId || '').trim().toLowerCase();
  return [
    {
      $lookup: {
        from: 'messagestatuses',
        let: { messageId: '$messageId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$messageId', '$$messageId'] },
                  { $eq: ['$tenantId', tenantId] },
                  { $eq: [{ $toLower: '$userId' }, uid] },
                  { $eq: ['$status', 'read'] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: 'readStatus'
      }
    },
    { $match: { readStatus: { $size: 0 } } }
  ];
}
