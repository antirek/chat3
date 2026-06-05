/**
 * A12: непрочитано = нет записи MessageStatus со status 'read' для (messageId, userId).
 * system.* и sender исключаются на уровне агрегации Message.
 * Граница join: Message.createdAt >= DialogMember.createdAt (см. DIALOG_MEMBER_ADD_JOIN_BOUNDARY_PLAN.md).
 */

export type UnreadMessageMatchOptions = {
  memberJoinedAt?: number;
};

/** Доп. условия $match для Message при подсчёте unread. */
export function unreadMessageMatchExtras(
  viewerUserId: string,
  options: UnreadMessageMatchOptions = {}
): Record<string, unknown> {
  const uid = (viewerUserId || '').trim().toLowerCase();
  const match: Record<string, unknown> = {
    senderId: { $ne: uid },
    type: { $not: { $regex: /^system\./ } }
  };
  if (options.memberJoinedAt != null) {
    match.createdAt = { $gte: options.memberJoinedAt };
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
