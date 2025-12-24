import { Dialog, DialogMember, Meta } from '../../../models/index.js';
import * as unreadCountUtils from '../utils/unreadCountUtils.js';
import * as eventUtils from '../utils/eventUtils.js';
import { sanitizeResponse } from '../utils/responseUtils.js';
import * as metaUtils from '../utils/metaUtils.js';
import { parseFilters, extractMetaFilters } from '../utils/queryParser.js';
import { generateTimestamp } from '../../../utils/timestampUtils.js';
import { scheduleDialogReadTask } from '../utils/dialogReadTaskUtils.js';
import * as userUtils from '../utils/userUtils.js';
import { 
  updateUserStatsDialogCount,
  finalizeCounterUpdateContext 
} from '../utils/counterUtils.js';

const dialogMemberController = {
  // Add member to dialog
  async addDialogMember(req, res) {
    try {
      const { dialogId } = req.params;
      const { userId, type, name } = req.body;

      if (!userId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: userId'
        });
      }

      // Найти Dialog по dialogId для получения ObjectId
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: req.tenantId });
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Проверяем, существует ли участник уже в диалоге
      const existingMember = await DialogMember.findOne({
        tenantId: req.tenantId,
        dialogId: dialog.dialogId,
        userId
      }).lean();

      if (existingMember) {
        // Участник уже существует - просто возвращаем успешный ответ
        return res.status(200).json({
          data: sanitizeResponse({
            userId,
            dialogId: dialog.dialogId
          }),
          message: 'Member already exists in dialog'
        });
      }

      // Проверяем и создаем пользователя, если его нет
      await userUtils.ensureUserExists(req.tenantId, userId, {
        type,
        name
      });

      const member = await unreadCountUtils.addDialogMember(
        req.tenantId,
        userId,
        dialog.dialogId // Передаем строковый dialogId
      );

      // Получаем метаданные диалога для события
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      const memberSection = eventUtils.buildMemberSection({
        userId: member.userId,
        state: {
          unreadCount: member.unreadCount,
          lastSeenAt: member.lastSeenAt,
          lastMessageAt: member.lastMessageAt
        }
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.member.add',
        dialogId: dialog.dialogId,
        entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
        includedSections: ['dialog', 'member'],
        updatedFields: ['member']
      });

      // КРИТИЧНО: Создаем событие и сохраняем eventId для обновления счетчиков
      const memberEvent = await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.member.add',
        entityType: 'dialogMember',
        entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          member: memberSection
        })
      });

      const sourceEventId = memberEvent?._id || null;

      // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
      try {
        // Обновление dialogCount
        await updateUserStatsDialogCount(
          req.tenantId,
          userId,
          1, // delta
          'dialog.member.add',
          sourceEventId,
          req.apiKey?.name || 'unknown',
          'api'
        );
      } finally {
        // Создаем user.stats.update после всех изменений счетчиков
        try {
          await finalizeCounterUpdateContext(req.tenantId, userId, sourceEventId);
        } catch (error) {
          console.error(`Failed to finalize context for ${userId}:`, error);
        }
      }

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
      const { page: pageParam, limit: limitParam, filter, sort: sortParam, sortDirection } = req.query;

      // Преобразуем page и limit в числа
      const page = parseInt(pageParam, 10) || 1;
      const limit = parseInt(limitParam, 10) || 10;

      const dialog = await Dialog.findOne({ tenantId: req.tenantId, dialogId }).select('dialogId').lean();
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      // Убеждаемся, что page и limit - числа
      const skip = Math.max(0, (page - 1) * limit);
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
      const allowedFilterFields = new Set(['userId', 'role', 'unreadCount', 'lastSeenAt', 'lastMessageAt', 'joinedAt']);

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

      // Парсим параметр sort, который может быть в формате (field,asc) или (field,desc)
      let sortField = 'joinedAt';
      let sortDir = -1; // По умолчанию desc
      
      if (sortParam) {
        // Проверяем формат (field,direction)
        const sortMatch = sortParam.match(/^\(([^,]+),([^)]+)\)$/);
        if (sortMatch) {
          const [, field, direction] = sortMatch;
          sortField = field.trim();
          sortDir = direction.trim().toLowerCase() === 'asc' ? 1 : -1;
        } else {
          // Простой формат: просто имя поля
          sortField = sortParam;
          sortDir = sortDirection === 'asc' ? 1 : -1;
        }
      } else if (sortDirection) {
        sortDir = sortDirection === 'asc' ? 1 : -1;
      }
      
      const allowedSortFields = new Set(['joinedAt', 'lastSeenAt', 'lastMessageAt', 'unreadCount', 'userId', 'isActive', 'role']);
      if (!allowedSortFields.has(sortField)) {
        sortField = 'joinedAt';
      }
      
      // Добавляем вторичную сортировку для стабильности (чтобы при одинаковых значениях порядок был предсказуемым)
      // Всегда используем _id как вторичную сортировку для гарантии стабильности
      const sortOptions = { 
        [sortField]: sortDir,
        _id: 1 // Вторичная сортировка по _id для стабильности (гарантирует предсказуемый порядок)
      };

      const [total, members] = await Promise.all([
        DialogMember.countDocuments(memberQuery),
        DialogMember.find(memberQuery)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
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
        // Получаем метаданные диалога для события
        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
        const dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });

        const memberSection = eventUtils.buildMemberSection({
          userId: member.userId,
          state: {
            unreadCount: member.unreadCount,
            lastSeenAt: member.lastSeenAt,
            lastMessageAt: member.lastMessageAt
          }
        });

        const eventContext = eventUtils.buildEventContext({
          eventType: 'dialog.member.remove',
          dialogId: dialog.dialogId,
          entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
          includedSections: ['dialog', 'member'],
          updatedFields: ['member']
        });

        // КРИТИЧНО: Создаем событие и сохраняем eventId для обновления счетчиков
        const memberEvent = await eventUtils.createEvent({
          tenantId: req.tenantId,
          eventType: 'dialog.member.remove',
          entityType: 'dialogMember',
          entityId: `${dialog.dialogId}:${userId}`, // Используем составной ID
          actorId: req.apiKey?.name || 'unknown',
          actorType: 'api',
          data: eventUtils.composeEventData({
            context: eventContext,
            dialog: dialogSection,
            member: memberSection
          })
        });

        const sourceEventId = memberEvent?._id || null;

        // КРИТИЧНО: Используем try-finally для гарантированной финализации контекстов
        try {
          // Обновление dialogCount
          await updateUserStatsDialogCount(
            req.tenantId,
            userId,
            -1, // delta
            'dialog.member.remove',
            sourceEventId,
            req.apiKey?.name || 'unknown',
            'api'
          );
        } finally {
          // Создаем user.stats.update после всех изменений счетчиков
          try {
            await finalizeCounterUpdateContext(req.tenantId, userId, sourceEventId);
          } catch (error) {
            console.error(`Failed to finalize context for ${userId}:`, error);
          }
        }
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
  },

  async setUnreadCount(req, res) {
    try {
      const { dialogId, userId } = req.params;
      // eslint-disable-next-line no-unused-vars
      const { unreadCount, lastSeenAt, reason } = req.body;

      const dialog = await Dialog.findOne({ dialogId, tenantId: req.tenantId }).select('dialogId');
      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
      }

      const memberFilter = {
        tenantId: req.tenantId,
        dialogId: dialog.dialogId,
        userId
      };

      const existingMember = await DialogMember.findOne(memberFilter).lean();
      if (!existingMember) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Dialog member not found'
        });
      }

      if (unreadCount > existingMember.unreadCount) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Unread count cannot be greater than current unread count'
        });
      }

      const timestamp = generateTimestamp();
      const updatePayload = {
        unreadCount
      };

      if (typeof lastSeenAt === 'number') {
        updatePayload.lastSeenAt = lastSeenAt;
      } else if (unreadCount < existingMember.unreadCount) {
        updatePayload.lastSeenAt = timestamp;
      }

      const updatedMember = await DialogMember.findOneAndUpdate(
        memberFilter,
        updatePayload,
        { new: true, lean: true }
      );

      // Получаем метаданные диалога для события
      const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
      const dialogSection = eventUtils.buildDialogSection({
        dialogId: dialog.dialogId,
        tenantId: dialog.tenantId,
        createdAt: dialog.createdAt,
        meta: dialogMeta || {}
      });

      const memberSection = eventUtils.buildMemberSection({
        userId,
        state: {
          unreadCount: updatedMember.unreadCount,
          lastSeenAt: updatedMember.lastSeenAt,
          lastMessageAt: updatedMember.lastMessageAt,
        }
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'dialog.member.update',
        dialogId: dialog.dialogId,
        entityId: dialog.dialogId,
        includedSections: ['dialog', 'member'],
        updatedFields: ['member.state.unreadCount', 'member.state.lastSeenAt']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId,
        eventType: 'dialog.member.update',
        entityType: 'dialogMember',
        entityId: dialog.dialogId,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          member: memberSection,
          extra: {
            delta: {
              unreadCount: {
                from: existingMember.unreadCount,
                to: updatedMember.unreadCount
              }
            }
          }
        })
      });

      if (updatedMember.unreadCount === 0) {
        await scheduleDialogReadTask({
          tenantId: req.tenantId,
          dialogId: dialog.dialogId,
          userId,
          readUntil: updatedMember.lastSeenAt,
          source: 'api.setUnreadCount'
        });
      }

      return res.json({
        data: sanitizeResponse(updatedMember),
        message: 'Unread count updated successfully'
      });
    } catch (error) {
      return res.status(500).json({
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
