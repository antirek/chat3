import { Dialog, DialogMember, Meta } from '../models/index.js';
import * as unreadCountUtils from '../utils/unreadCountUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';

const dialogMemberController = {
  // Add member to dialog
  async addDialogMember(req, res) {
    try {
      const { dialogId, userId } = req.params;

      // Найти Dialog по dialogId для получения ObjectId
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      const member = await unreadCountUtils.addDialogMember(
        req.tenantId,
        userId,
        dialog.dialogId // Передаем строковый dialogId
      );

      // Создаем событие dialog.member.add
      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.member.add',
        entityType: 'dialogMember',
        entityId: dialogId + ':' + member.userId, // Составной ID для dialogMember (dialogId:userId)
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: {
          userId,
          dialogId
        }
      });

      res.status(201).json({
        data: sanitizeResponse({
          userId,
          dialogId
        }),
        message: 'Member added to dialog successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  async getDialogMembers(req, res) {
    try {
      const { dialogId } = req.params;
      const { page = 1, limit = 10, filter, sort, sortDirection } = req.query;

      const dialog = await Dialog.findOne({ tenantId: req.tenantId, dialogId }).select('dialogId').lean();
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      const skip = (page - 1) * limit;
      let parsedFilters = {};

      if (filter) {
        try {
          parsedFilters = parseFilters(filter);
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Invalid filter format. ${error.message}`
          });
        }
      }

      const { metaFilters, regularFilters } = extractMetaFilters(parsedFilters);
      const allowedFilterFields = new Set(['userId', 'role', 'isActive', 'unreadCount', 'lastSeenAt', 'lastMessageAt', 'joinedAt']);

      const memberQuery = {
        tenantId: req.tenantId,
        dialogId: dialog.dialogId
      };

      if (regularFilters.$and && Array.isArray(regularFilters.$and)) {
        const andConditions = regularFilters.$and.filter(condition => {
          const [key] = Object.keys(condition);
          return allowedFilterFields.has(key);
        });

        if (andConditions.length > 0) {
          memberQuery.$and = andConditions;
        }

        delete regularFilters.$and;
      }

      for (const [key, value] of Object.entries(regularFilters)) {
        if (!allowedFilterFields.has(key)) {
          continue;
        }
        memberQuery[key] = value;
      }

      if (Object.keys(metaFilters).length > 0) {
        const userIds = await findMemberUserIdsByMeta(req.tenantId, dialog.dialogId, metaFilters);

        if (userIds.length === 0) {
          return res.json({
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              pages: 0
            }
          });
        }

        const metaCondition = { userId: { $in: userIds } };

        if (memberQuery.userId !== undefined) {
          memberQuery.$and = memberQuery.$and || [];
          memberQuery.$and.push({ userId: memberQuery.userId });
          delete memberQuery.userId;
        }

        memberQuery.$and = memberQuery.$and || [];
        memberQuery.$and.push(metaCondition);
      }

      const allowedSortFields = new Set(['joinedAt', 'lastSeenAt', 'lastMessageAt', 'unreadCount', 'userId', 'isActive', 'role']);
      const sortField = allowedSortFields.has(sort) ? sort : 'joinedAt';
      const sortDir = sortDirection === 'asc' ? 1 : -1;
      const sortOptions = { [sortField]: sortDir };

      const [total, members] = await Promise.all([
        DialogMember.countDocuments(memberQuery),
        DialogMember.find(memberQuery)
          .skip(skip)
          .limit(limit)
          .sort(sortOptions)
          .select('-__v')
          .lean()
      ]);

      const membersWithMeta = await Promise.all(
        members.map(async (member) => {
          const memberMeta = await metaUtils.getEntityMeta(
            req.tenantId,
            'dialogMember',
            `${dialog.dialogId}:${member.userId}`
          );

          return {
            ...member,
            meta: memberMeta
          };
        })
      );

      return res.json({
        data: sanitizeResponse(membersWithMeta),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Remove member from dialog
  async removeDialogMember(req, res) {
    try {
      const { dialogId, userId } = req.params;

      // Найти Dialog по dialogId для получения ObjectId
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Получаем member перед удалением для события
      const member = await DialogMember.findOne({
        tenantId: req.tenantId,
        userId,
        dialogId: dialog.dialogId // Используем строковый dialogId
      });

      await unreadCountUtils.removeDialogMember(
        req.tenantId,
        userId,
        dialog.dialogId // Передаем строковый dialogId
      );

      // Создаем событие dialog.member.remove
      if (member) {
        await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.remove',
          entityType: 'dialogMember',
          entityId: dialogId + ':' + userId, // Составной ID для dialogMember (dialogId:userId)
          actorId: req.apiKey?.name || 'unknown',
          actorType: 'api',
          data: {
            userId,
            dialogId,
            removedMember: {
              userId: member.userId,
              joinedAt: member.joinedAt,
              lastSeenAt: member.lastSeenAt,
              unreadCount: member.unreadCount
            }
          }
        });
      }

      res.json({
        message: 'Member removed from dialog successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

function extractUserIdFromEntityId(entityId) {
  if (typeof entityId !== 'string') {
    return null;
  }
  const parts = entityId.split(':');
  return parts.length === 2 ? parts[1] : null;
}

async function findMemberUserIdsByMeta(tenantId, dialogId, metaFilters) {
  if (!metaFilters || Object.keys(metaFilters).length === 0) {
    return [];
  }

  let matchingUserIds = null;

  for (const [key, condition] of Object.entries(metaFilters)) {
    const baseQuery = {
      tenantId,
      entityType: 'dialogMember',
      key,
      entityId: new RegExp(`^${dialogId}:`)
    };

    const isNegativeOperator =
      typeof condition === 'object' &&
      condition !== null &&
      (Object.prototype.hasOwnProperty.call(condition, '$ne') ||
        Object.prototype.hasOwnProperty.call(condition, '$nin'));

    let candidateUserIds = [];

    if (isNegativeOperator) {
      const allWithKey = await Meta.find(baseQuery).select('entityId value').lean();

      if (Array.isArray(condition.$nin)) {
        const excludeSet = new Set(condition.$nin);
        candidateUserIds = allWithKey
          .filter(record => !excludeSet.has(record.value))
          .map(record => extractUserIdFromEntityId(record.entityId))
          .filter(Boolean);
      } else if (condition.$ne !== undefined) {
        candidateUserIds = allWithKey
          .filter(record => record.value !== condition.$ne)
          .map(record => extractUserIdFromEntityId(record.entityId))
          .filter(Boolean);
      }
    } else {
      const metaRecords = await Meta.find({
        ...baseQuery,
        value: condition
      })
        .select('entityId')
        .lean();

      candidateUserIds = metaRecords
        .map(record => extractUserIdFromEntityId(record.entityId))
        .filter(Boolean);
    }

    if (candidateUserIds.length === 0) {
      return [];
    }

    if (matchingUserIds === null) {
      matchingUserIds = new Set(candidateUserIds);
    } else {
      const currentSet = new Set(candidateUserIds);
      matchingUserIds = new Set(
        Array.from(matchingUserIds).filter(userId => currentSet.has(userId))
      );
    }
  }

  return matchingUserIds ? Array.from(matchingUserIds) : [];
}

export default dialogMemberController;
