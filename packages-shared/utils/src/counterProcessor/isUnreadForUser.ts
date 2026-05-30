/**
 * A12: непрочитано = нет записи MessageStatus со status 'read' для (messageId, userId).
 * system.* и sender исключаются на уровне агрегации Message.
 */

/** Доп. условия $match для Message при подсчёте unread. */
export function unreadMessageMatchExtras(viewerUserId: string): Record<string, unknown> {
  const uid = (viewerUserId || '').trim().toLowerCase();
  return {
    senderId: { $ne: uid },
    type: { $not: { $regex: /^system\./ } }
  };
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
