import mongoose from 'mongoose';
import { Dialog, Message, DialogMember, Meta, MessageStatus, Update, User } from '../models/index.js';
import * as metaUtils from '../apps/tenant-api/utils/metaUtils.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';
import { sanitizeResponse } from '../apps/tenant-api/utils/responseUtils.js';
import { generateTimestamp } from './timestampUtils.js';
import { getUserType } from '../apps/tenant-api/utils/userTypeUtils.js';
import { buildStatusMessageMatrix } from '../apps/tenant-api/utils/userDialogUtils.js';

const DEFAULT_TYPING_EXPIRES_MS = 5000;

const DIALOG_UPDATE_EVENTS = [
  'dialog.create',
  'dialog.update',
  'dialog.delete',
  'dialog.member.add',
  'dialog.member.remove'
];

const DIALOG_MEMBER_UPDATE_EVENTS = [
  'dialog.member.update'
];

const MESSAGE_UPDATE_EVENTS = [
  'message.create',
  'message.update',
  'message.reaction.update',
  'message.status.update'
];

const TYPING_EVENTS = [
  'dialog.typing'
];

function buildDialogSection(dialog, dialogMeta = {}) {
  if (!dialog) {
    return null;
  }

  return {
    dialogId: dialog.dialogId,
    tenantId: dialog.tenantId,
    createdBy: dialog.createdBy,
    createdAt: dialog.createdAt,
    meta: dialogMeta || {}
  };
}

function buildMemberSection(member, memberMeta = {}, overrides = {}) {
  if (!member) {
    return null;
  }

  const state = {
    unreadCount: overrides.unreadCount ?? member.unreadCount ?? null,
    lastSeenAt: overrides.lastSeenAt ?? member.lastSeenAt ?? null,
    lastMessageAt: overrides.lastMessageAt ?? member.lastMessageAt ?? null,
    isActive: overrides.isActive ?? member.isActive ?? null
  };

  return {
    userId: member.userId,
    meta: memberMeta || {},
    state
  };
}

function buildContextSection({
  eventType,
  dialogId,
  entityId,
  messageId = null,
  reason = null,
  includedSections = [],
  updatedFields = []
}) {
  const context = {
    eventType,
    dialogId,
    entityId,
    includedSections,
    updatedFields
  };

  if (messageId) {
    context.messageId = messageId;
  }

  if (reason) {
    context.reason = reason;
  }

  return context;
}

function cloneSection(section) {
  if (!section) {
    return null;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(section);
  }

  return JSON.parse(JSON.stringify(section));
}

async function getSenderInfo(tenantId, senderId, cache = new Map()) {
  if (!senderId) {
    return null;
  }

  if (cache.has(senderId)) {
    return cache.get(senderId);
  }

  const user = await User.findOne({
    tenantId,
    userId: senderId
  })
    .select('userId name lastActiveAt createdAt updatedAt')
    .lean();

  const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', senderId);

  if (!user && (!userMeta || Object.keys(userMeta).length === 0)) {
    cache.set(senderId, null);
    return null;
  }

  const senderInfo = {
    userId: senderId,
    lastActiveAt: user?.lastActiveAt ?? null,
    createdAt: user?.createdAt ?? null,
    meta: userMeta
  };

  cache.set(senderId, senderInfo);
  return senderInfo;
}

async function buildFullMessagePayload(tenantId, message, senderCache = new Map()) {
  if (!message) {
    return null;
  }

  const messageObj = message.toObject ? message.toObject() : message;

  const meta = (await metaUtils.getEntityMeta(tenantId, 'message', messageObj.messageId)) || {};

  const statuses = await MessageStatus.find({
    tenantId,
    messageId: messageObj.messageId
  })
    .select('userId status readAt deliveredAt createdAt updatedAt')
    .sort({ createdAt: -1 })
    .lean();

  const senderInfo = await getSenderInfo(tenantId, messageObj.senderId, senderCache);

  return {
    ...messageObj,
    meta,
    statuses,
    senderInfo: senderInfo || null
  };
}

/**
 * Формирует DialogUpdate для всех участников диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export async function createDialogUpdate(tenantId, dialogId, eventId, eventType, eventData = {}) {
  try {
    // Используем данные из event.data напрямую, если они есть
    let eventDialog = eventData.dialog;
    let eventContext = eventData.context || {};

    // Fallback: если данных нет в event.data, загружаем из БД (для обратной совместимости)
    if (!eventDialog || !eventDialog.dialogId) {
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: tenantId });
      if (!dialog) {
        console.error(`Dialog with dialogId ${dialogId} not found for update`);
        return;
      }
      const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
      eventDialog = buildDialogSection(dialog, dialogMeta);
    }

    if (!eventContext.eventType) {
      eventContext = {
        eventType,
        dialogId: eventDialog.dialogId,
        entityId: eventDialog.dialogId,
        includedSections: ['dialog', 'member']
      };
    }

    // Получаем всех участников диалога (единственное, что нужно загрузить из БД)
    const dialogMembers = await DialogMember.find({
      tenantId: tenantId,
      dialogId: eventDialog.dialogId,
      isActive: true
    }).lean();

    // Для события dialog.member.remove нужно также создать update для удаляемого пользователя
    let removedMember = null;
    if (eventType === 'dialog.member.remove' && eventData.member) {
      const removedUserId = eventData.member.userId;
      if (removedUserId) {
        // Проверяем, не является ли удаляемый пользователь уже в списке активных
        const isAlreadyInList = dialogMembers.some(m => m.userId === removedUserId);
        
        if (!isAlreadyInList) {
          // Получаем информацию об удаляемом участнике (даже если он уже неактивен)
          removedMember = await DialogMember.findOne({
            tenantId: tenantId,
            dialogId: eventDialog.dialogId,
            userId: removedUserId
          }).lean();
          
          // Если не нашли в БД, создаем объект из данных события
          if (!removedMember && eventData.member) {
            removedMember = {
              userId: removedUserId,
              tenantId: tenantId,
              dialogId: eventDialog.dialogId,
              unreadCount: eventData.member.state?.unreadCount ?? 0,
              lastSeenAt: eventData.member.state?.lastSeenAt ?? null,
              lastMessageAt: eventData.member.state?.lastMessageAt ?? null,
              isActive: false,
              role: eventData.member.role || 'member'
            };
          }
        }
      }
    }

    if (dialogMembers.length === 0 && !removedMember) {
      console.log(`No active members found for dialog ${dialogId} and no removed member to notify`);
      return;
    }
    
    // Собираем всех участников для создания updates (активные + удаляемый, если есть)
    const allMembersForUpdates = [...dialogMembers];
    if (removedMember) {
      allMembersForUpdates.push(removedMember);
    }
    
    // Загружаем метаданные участников
    const memberMetaEntries = await Promise.all(
      allMembersForUpdates.map(async member => {
        const memberId = `${eventDialog.dialogId}:${member.userId}`;
        const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);
        return { userId: member.userId, meta: memberMeta || {} };
      })
    );
    const memberMetaMap = new Map(memberMetaEntries.map(entry => [entry.userId, entry.meta]));

    // Используем context из event.data, если есть, иначе создаем минимальный
    const context = eventContext.eventType ? cloneSection(eventContext) : {
      eventType,
      dialogId: eventDialog.dialogId,
      entityId: eventDialog.dialogId,
      includedSections: ['dialog', 'member']
    };

    const updates = allMembersForUpdates.map((member) => {
      // Для удаляемого пользователя устанавливаем isActive: false
      const isRemovedMember = removedMember && member.userId === removedMember.userId;
      const memberOverrides = isRemovedMember ? { isActive: false } : {};
      
      const memberSection = buildMemberSection(member, memberMetaMap.get(member.userId), memberOverrides);

      const data = {
        dialog: cloneSection(eventDialog),
        member: memberSection,
        context: cloneSection(context)
      };

      return {
        tenantId: tenantId,
        userId: member.userId,
        dialogId: eventDialog.dialogId,
        entityId: eventDialog.dialogId,
        eventId: eventId,
        eventType: eventType,
        data,
        published: false
      };
    });

    // Сохраняем updates в БД
    const savedUpdates = await Update.insertMany(updates);

    // Публикуем updates в RabbitMQ асинхронно
    savedUpdates.forEach(update => {
      publishUpdate(update).catch(err => {
        console.error(`Error publishing update ${update._id}:`, err);
      });
    });

    console.log(`Created ${savedUpdates.length} DialogUpdate for dialog ${dialogId}`);
  } catch (error) {
    console.error('Error creating DialogUpdate:', error);
  }
}

/**
 * Формирует DialogMemberUpdate для конкретного участника диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export async function createDialogMemberUpdate(tenantId, dialogId, userId, eventId, eventType, eventData = {}) {
  try {
    // Используем данные из event.data напрямую, если они есть
    let eventDialog = eventData.dialog;
    const eventMember = eventData.member;
    let eventContext = eventData.context || {};

    // Fallback: если данных нет в event.data, загружаем из БД (для обратной совместимости)
    if (!eventDialog || !eventDialog.dialogId) {
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: tenantId });
      if (!dialog) {
        console.error(`Dialog with dialogId ${dialogId} not found for update`);
        return;
      }
      const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
      eventDialog = buildDialogSection(dialog, dialogMeta);
    }

    // Получаем конкретного участника из БД (нужно для получения полных данных)
    const member = await DialogMember.findOne({
      tenantId: tenantId,
      dialogId: eventDialog.dialogId,
      userId: userId,
      isActive: true
    }).lean();

    if (!member) {
      console.log(`Member ${userId} not found in dialog ${dialogId}`);
      return;
    }

    // Загружаем метаданные участника
    const memberId = `${eventDialog.dialogId}:${member.userId}`;
    const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);
    
    // Используем state из event.data.member, если есть
    const eventMemberState = eventMember?.state || {};
    const overrideUnreadCount = eventMemberState.unreadCount !== undefined
      ? eventMemberState.unreadCount
      : eventData.unreadCount;
    const overrideLastSeenAt = eventMemberState.lastSeenAt !== undefined
      ? eventMemberState.lastSeenAt
      : eventData.lastSeenAt;

    const memberSection = buildMemberSection(member, memberMeta, {
      unreadCount: overrideUnreadCount,
      lastSeenAt: overrideLastSeenAt,
      lastMessageAt: eventMemberState.lastMessageAt
    });

    // Используем updatedFields из event.context, если есть
    let updatedFields = Array.isArray(eventContext.updatedFields)
      ? [...eventContext.updatedFields]
      : [];
    if (!updatedFields.length) {
      if (eventMemberState.unreadCount !== undefined) {
        updatedFields.push('member.state.unreadCount');
      }
      if (eventMemberState.lastSeenAt !== undefined) {
        updatedFields.push('member.state.lastSeenAt');
      }
      if (eventData.unreadCount !== undefined && !updatedFields.includes('member.state.unreadCount')) {
        updatedFields.push('member.state.unreadCount');
      }
      if (eventData.lastSeenAt !== undefined && !updatedFields.includes('member.state.lastSeenAt')) {
        updatedFields.push('member.state.lastSeenAt');
      }
    }

    // Используем context из event.data, если есть, иначе создаем минимальный
    const context = eventContext.eventType ? {
      ...cloneSection(eventContext),
      updatedFields
    } : {
      eventType,
      dialogId: eventDialog.dialogId,
      entityId: eventDialog.dialogId,
      includedSections: ['dialog', 'member'],
      updatedFields
    };

    const data = {
      dialog: cloneSection(eventDialog),
      member: memberSection,
      context
    };

    const updateData = {
      tenantId: tenantId,
      userId: userId,
      dialogId: eventDialog.dialogId,
      entityId: eventDialog.dialogId,
      eventId: eventId,
      eventType: eventType,
      data,
      published: false
    };

    // Сохраняем update в БД
    const savedUpdate = await Update.create(updateData);

    // Публикуем update в RabbitMQ
    await publishUpdate(savedUpdate).catch(err => {
      console.error(`Error publishing update ${savedUpdate._id}:`, err);
    });

    console.log(`Created DialogMemberUpdate for user ${userId} in dialog ${dialogId}`);
  } catch (error) {
    console.error('Error creating DialogMemberUpdate:', error);
  }
}

/**
 * Формирует MessageUpdate для всех участников диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export async function createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType, eventData = {}) {
  try {
    // Используем данные из event.data напрямую, если они есть
    let eventDialog = eventData.dialog;
    let eventMessage = eventData.message || {};
    let eventContext = eventData.context || {};

    // Fallback: если данных нет в event.data, загружаем из БД (для обратной совместимости)
    if (!eventDialog || !eventDialog.dialogId) {
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: tenantId });
      if (!dialog) {
        console.error(`Dialog with dialogId ${dialogId} not found for update`);
        return;
      }
      const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
      eventDialog = buildDialogSection(dialog, dialogMeta);
    }

    if (!eventMessage || !eventMessage.messageId) {
      const message = await Message.findOne({ messageId: messageId, tenantId: tenantId });
      if (!message) {
        console.error(`Message ${messageId} not found for update`);
        return;
      }
      // Для message.create/update нужно полное сообщение
      if (['message.create', 'message.update'].includes(eventType)) {
        const senderCache = new Map();
        eventMessage = await buildFullMessagePayload(tenantId, message, senderCache);
        if (!eventMessage) {
          console.error(`Failed to build message payload for ${messageId}`);
          return;
        }
        eventMessage.dialogId = eventDialog.dialogId;
      } else {
        // Для других типов создаем минимальную структуру
        eventMessage = {
          messageId: message.messageId,
          dialogId: eventDialog.dialogId,
          senderId: message.senderId,
          type: message.type
        };
        // Добавляем данные из eventData, если есть
        if (eventData.message?.statusUpdate) {
          eventMessage.statusUpdate = eventData.message.statusUpdate;
        } else if (eventType.startsWith('message.status.') && eventData.userId) {
          // Fallback для старого формата: { userId, newStatus, oldStatus }
          eventMessage.statusUpdate = {
            userId: eventData.userId,
            status: eventData.newStatus,
            oldStatus: eventData.oldStatus ?? null
          };
          // Для message.status.update нужно добавить statusMessageMatrix
          const statusMessageMatrix = await buildStatusMessageMatrix(tenantId, messageId, message.senderId);
          eventMessage.statusMessageMatrix = statusMessageMatrix;
        }
        if (eventData.message?.reactionUpdate) {
          eventMessage.reactionUpdate = eventData.message.reactionUpdate;
        } else if (eventType.startsWith('message.reaction.') && eventData.userId) {
          // Fallback для старого формата
          eventMessage.reactionUpdate = {
            userId: eventData.userId,
            reaction: eventData.reaction,
            oldReaction: eventData.oldReaction ?? null,
            reactionSet: eventData.reactionSet ?? null
          };
        }
        if (eventData.message?.statusMessageMatrix) {
          eventMessage.statusMessageMatrix = eventData.message.statusMessageMatrix;
        }
      }
    }

    if (!eventContext.eventType) {
      eventContext = {
        eventType,
        dialogId: eventDialog.dialogId,
        entityId: eventMessage.messageId,
        messageId: eventMessage.messageId,
        includedSections: eventContext.includedSections || [],
        updatedFields: eventContext.updatedFields || []
      };
    }

    // Получаем всех участников диалога (единственное, что нужно загрузить из БД)
    const dialogMembers = await DialogMember.find({
      tenantId: tenantId,
      dialogId: eventDialog.dialogId,
      isActive: true
    }).select('userId').lean();

    if (dialogMembers.length === 0) {
      console.log(`No active members found for dialog ${dialogId}`);
      return;
    }

    // Для message.status.update и message.reaction.update не нужна member секция
    const needsMemberSection = !['message.status.update', 'message.reaction.update'].includes(eventType);
    
    // Загружаем метаданные участников только если нужна member секция
    let memberMetaMap = new Map();
    if (needsMemberSection) {
      const memberMetaEntries = await Promise.all(
        dialogMembers.map(async member => {
          const memberId = `${eventDialog.dialogId}:${member.userId}`;
          const memberMeta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', memberId);
          return { userId: member.userId, meta: memberMeta || {} };
        })
      );
      memberMetaMap = new Map(memberMetaEntries.map(entry => [entry.userId, entry.meta]));
    }

    // Используем context из event.data, если есть, иначе создаем минимальный
    const context = eventContext.eventType ? cloneSection(eventContext) : {
      eventType,
      dialogId: eventDialog.dialogId,
      entityId: eventMessage.messageId,
      messageId: eventMessage.messageId,
      includedSections: eventContext.includedSections || [],
      updatedFields: eventContext.updatedFields || []
    };

    const updates = dialogMembers.map(member => {
      const data = {
        dialog: cloneSection(eventDialog),
        message: cloneSection(eventMessage),
        context: cloneSection(context)
      };
      
      // Добавляем member секцию только если нужна
      if (needsMemberSection) {
        const memberSection = buildMemberSection(member, memberMetaMap.get(member.userId));
        data.member = memberSection;
      }

      return {
        tenantId: tenantId,
        userId: member.userId,
        dialogId: eventDialog.dialogId,
        entityId: eventMessage.messageId,
        eventId: eventId,
        eventType: eventType,
        data,
        published: false
      };
    });

    // Сохраняем updates в БД
    const savedUpdates = await Update.insertMany(updates);

    // Публикуем updates в RabbitMQ асинхронно
    savedUpdates.forEach(update => {
      publishUpdate(update).catch(err => {
        console.error(`Error publishing update ${update._id}:`, err);
      });
    });

    console.log(`Created ${savedUpdates.length} MessageUpdate for message ${messageId}`);
  } catch (error) {
    console.error('Error creating MessageUpdate:', error);
  }
}

/**
 * Формирует TypingUpdate для всех участников диалога (кроме инициатора)
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export async function createTypingUpdate(tenantId, dialogId, typingUserId, eventId, eventType, eventData = {}) {
  try {
    // Используем данные из event.data напрямую, если они есть
    let eventDialog = eventData.dialog;
    const eventTyping = eventData.typing || {};
    let eventContext = eventData.context || {};

    // Fallback: если данных нет в event.data, загружаем из БД (для обратной совместимости)
    if (!eventDialog || !eventDialog.dialogId) {
      const dialog = await Dialog.findOne({ dialogId: dialogId, tenantId: tenantId });
      if (!dialog) {
        console.error(`Dialog with dialogId ${dialogId} not found for typing update`);
        return;
      }
      const dialogMeta = await metaUtils.getEntityMeta(tenantId, 'dialog', dialogId);
      eventDialog = buildDialogSection(dialog, dialogMeta);
    }

    if (!eventContext.eventType) {
      eventContext = {
        eventType,
        dialogId: eventDialog.dialogId,
        entityId: eventDialog.dialogId,
        includedSections: ['dialog', 'member', 'typing']
      };
    }

    // Получаем всех участников диалога (единственное, что нужно загрузить из БД)
    const dialogMembers = await DialogMember.find({
      tenantId,
      dialogId: eventDialog.dialogId,
      isActive: true
    }).lean();

    if (dialogMembers.length === 0) {
      console.log(`No active members found for typing update in dialog ${dialogId}`);
      return;
    }

    // Используем typing данные из event.data
    // Поддерживаем как новый формат (eventData.typing), так и старый (плоские поля в eventData)
    const legacyTyping = eventData.typing ? {} : eventData;
    const typingSection = {
      userId: typingUserId,
      expiresInMs: eventTyping.expiresInMs ?? legacyTyping.expiresInMs ?? DEFAULT_TYPING_EXPIRES_MS,
      timestamp: eventTyping.timestamp ?? legacyTyping.timestamp ?? Date.now(),
      userInfo: eventTyping.userInfo ?? legacyTyping.userInfo ?? null
    };

    // Загружаем метаданные участников
    const memberMetaEntries = await Promise.all(
      dialogMembers.map(async member => {
        const meta = await metaUtils.getEntityMeta(tenantId, 'dialogMember', `${eventDialog.dialogId}:${member.userId}`);
        return { userId: member.userId, meta: meta || {} };
      })
    );
    const memberMetaMap = new Map(memberMetaEntries.map(entry => [entry.userId, entry.meta]));

    // Используем context из event.data, если есть, иначе создаем минимальный
    const context = eventContext.eventType ? cloneSection(eventContext) : {
      eventType,
      dialogId: eventDialog.dialogId,
      entityId: eventDialog.dialogId,
      includedSections: ['dialog', 'member', 'typing']
    };

    const updatesPayload = dialogMembers
      .filter(member => member.userId !== typingUserId)
      .map(member => {
        const memberSection = buildMemberSection(member, memberMetaMap.get(member.userId));

        return {
          tenantId,
          userId: member.userId,
          dialogId: eventDialog.dialogId,
          entityId: eventDialog.dialogId,
          eventId,
          eventType,
          data: {
            dialog: cloneSection(eventDialog),
            member: memberSection,
            typing: typingSection,
            context: cloneSection(context)
          },
          published: false
        };
      });

    if (updatesPayload.length === 0) {
      console.log(`No recipients for typing update in dialog ${dialogId}`);
      return;
    }

    const savedUpdates = await Update.insertMany(updatesPayload);

    savedUpdates.forEach(update => {
      publishUpdate(update).catch(err => {
        console.error(`Error publishing typing update ${update._id}:`, err);
      });
    });

    console.log(`Created ${savedUpdates.length} TypingUpdate for dialog ${dialogId}`);
  } catch (error) {
    console.error('Error creating TypingUpdate:', error);
  }
}

/**
 * Публикует update в RabbitMQ
 */
async function publishUpdate(update) {
  try {
    const updateObj = update.toObject ? update.toObject() : update;
    
    // Сохраняем _id для логирования и обновления статуса
    const updateId = updateObj._id;
    
    // Очищаем update от _id, id и __v, включая вложенные объекты в data
    const sanitizedUpdate = sanitizeResponse(updateObj);
    
    // Определяем тип update из eventType
    const updateType = getUpdateTypeFromEventType(sanitizedUpdate.eventType);
    if (!updateType) {
      console.error(`Cannot determine update type for eventType: ${sanitizedUpdate.eventType}`);
      return;
    }
    
    // Получаем тип пользователя из модели User или используем fallback
    const userType = await getUserType(sanitizedUpdate.tenantId, sanitizedUpdate.userId);
    
    // Публикуем в exchange chat3_updates с routing key user.{type}.{userId}.{updateType}
    const routingKey = `user.${userType}.${sanitizedUpdate.userId}.${updateType.toLowerCase()}`;
    
    const published = await rabbitmqUtils.publishUpdate(sanitizedUpdate, routingKey);
    
    if (!published) {
      console.error(`❌ Failed to publish update ${updateId} to RabbitMQ (routing key: ${routingKey})`);
      throw new Error('Failed to publish update to RabbitMQ');
    }

    // Обновляем статус published только если публикация успешна
    await Update.updateOne(
      { _id: updateId },
      { 
        $set: { 
          published: true,
          publishedAt: generateTimestamp()
        } 
      }
    );
    
    console.log(`✅ Update ${updateId} published to RabbitMQ (${routingKey})`);
  } catch (error) {
    const updateId = update._id || (update.toObject ? update.toObject()._id : null);
    console.error(`❌ Error publishing update ${updateId}:`, error.message);
    throw error;
  }
}

/**
 * Определяет тип update из типа события
 */
export function getUpdateTypeFromEventType(eventType) {
  if (DIALOG_UPDATE_EVENTS.includes(eventType)) {
    return 'DialogUpdate';
  }
  if (DIALOG_MEMBER_UPDATE_EVENTS.includes(eventType)) {
    return 'DialogMemberUpdate';
  }
  if (MESSAGE_UPDATE_EVENTS.includes(eventType)) {
    return 'MessageUpdate';
  }
  if (TYPING_EVENTS.includes(eventType)) {
    return 'Typing';
  }
  return null;
}

/**
 * Определяет, нужно ли создавать update для события
 */
export function shouldCreateUpdate(eventType) {
  return {
    dialog: DIALOG_UPDATE_EVENTS.includes(eventType),
    dialogMember: DIALOG_MEMBER_UPDATE_EVENTS.includes(eventType),
    message: MESSAGE_UPDATE_EVENTS.includes(eventType),
    typing: TYPING_EVENTS.includes(eventType)
  };
}

