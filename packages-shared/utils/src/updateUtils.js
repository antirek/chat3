import mongoose from 'mongoose';
import { Message, DialogMember, MessageStatus, Update, User, UserStats, Event, UserDialogStats } from '@chat3/models';
import * as metaUtils from './metaUtils.js';
import * as rabbitmqUtils from './rabbitmqUtils.js';
import { sanitizeResponse } from './responseUtils.js';
import { generateTimestamp } from './timestampUtils.js';
import { getUserType } from './userTypeUtils.js';
import { buildStatusMessageMatrix } from './userDialogUtils.js';
import * as eventUtils from './eventUtils.js';
import * as topicUtils from './topicUtils.js';
const DEFAULT_TYPING_EXPIRES_MS = 5000;
/**
 * Преобразует eventId в строковый формат (evt_...) для использования в модели Update
 */
async function getEventIdString(eventId, tenantId) {
    if (!eventId) {
        return null;
    }
    // Если это уже строка evt_..., используем напрямую
    if (typeof eventId === 'string' && eventId.startsWith('evt_')) {
        return eventId;
    }
    // Если это ObjectId, находим Event и получаем его строковый eventId
    if (mongoose.Types.ObjectId.isValid(eventId) && eventId.toString().length === 24) {
        const event = await Event.findOne({ _id: eventId, tenantId }).select('eventId').lean();
        const eventObj = event;
        if (eventObj && eventObj.eventId) {
            return eventObj.eventId;
        }
        console.warn(`Event with ObjectId "${eventId}" not found for tenant ${tenantId}`);
        return null;
    }
    // Если формат неизвестен, возвращаем null
    console.warn(`Unknown eventId format: "${eventId}"`);
    return null;
}
const DIALOG_UPDATE_EVENTS = [
    'dialog.create',
    'dialog.update',
    'dialog.delete',
    'dialog.member.add',
    'dialog.member.remove',
    'dialog.topic.create',
    'dialog.topic.update'
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
const USER_UPDATE_EVENTS = [
    'user.add',
    'user.update',
    'user.remove'
];
function cloneSection(section) {
    if (!section) {
        return section;
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
        return cache.get(senderId) ?? null;
    }
    const user = await User.findOne({
        tenantId,
        userId: senderId
    })
        .select('userId name createdAt')
        .lean();
    const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', senderId);
    if (!user && (!userMeta || Object.keys(userMeta).length === 0)) {
        cache.set(senderId, null);
        return null;
    }
    const userObj = user;
    const senderInfo = {
        userId: senderId,
        createdAt: userObj?.createdAt ?? null,
        meta: userMeta
    };
    cache.set(senderId, senderInfo);
    return senderInfo;
}
async function buildFullMessagePayload(tenantId, message, senderCache = new Map()) {
    if (!message) {
        return null;
    }
    const messageObj = message.toObject
        ? message.toObject()
        : message;
    const meta = (await metaUtils.getEntityMeta(tenantId, 'message', messageObj.messageId)) || {};
    const statuses = await MessageStatus.find({
        tenantId,
        messageId: messageObj.messageId
    })
        .select('userId status readAt deliveredAt createdAt')
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
        // Преобразуем eventId в строковый формат (evt_...) для модели Update
        const eventIdString = await getEventIdString(eventId, tenantId);
        if (!eventIdString) {
            console.warn(`Cannot create DialogUpdate: eventId "${eventId}" not found for tenant ${tenantId}`);
            return;
        }
        // Используем данные из event.data напрямую
        const eventDialog = eventData.dialog;
        let eventContext = eventData.context || {};
        // Секция dialog должна всегда присутствовать в event.data
        if (!eventDialog || !eventDialog.dialogId) {
            console.error(`Dialog section missing in event.data for event ${eventId} (${eventType}). This should not happen.`);
            return;
        }
        if (!eventContext.eventType) {
            eventContext = {
                eventType,
                dialogId: eventDialog.dialogId,
                entityId: eventDialog.dialogId,
                includedSections: eventData.member ? ['dialog', 'member'] : ['dialog']
            };
        }
        // Получаем всех участников диалога (единственное, что нужно загрузить из БД)
        const dialogMembers = await DialogMember.find({
            tenantId: tenantId,
            dialogId: eventDialog.dialogId
        }).lean();
        // Для события dialog.member.remove нужно также создать update для удаляемого пользователя
        let removedMemberUserId = null;
        if (eventType === 'dialog.member.remove' && eventData.member) {
            removedMemberUserId = eventData.member.userId;
        }
        if (dialogMembers.length === 0 && !removedMemberUserId) {
            console.log(`No active members found for dialog ${dialogId} and no removed member to notify`);
            return;
        }
        // Собираем всех участников для создания updates (активные + удаляемый, если есть)
        const allMemberUserIds = dialogMembers.map(m => m.userId);
        if (removedMemberUserId && !allMemberUserIds.includes(removedMemberUserId)) {
            allMemberUserIds.push(removedMemberUserId);
        }
        // Используем context из event.data, если есть, иначе создаем минимальный
        const context = eventContext.eventType ? cloneSection(eventContext) : {
            eventType,
            dialogId: eventDialog.dialogId,
            entityId: eventDialog.dialogId,
            includedSections: eventData.member ? ['dialog', 'member'] : ['dialog']
        };
        // Получаем UserDialogStats для всех пользователей одним запросом
        const userDialogStatsList = await UserDialogStats.find({
            tenantId: tenantId,
            dialogId: eventDialog.dialogId,
            userId: { $in: allMemberUserIds }
        }).lean();
        // Создаем Map для быстрого доступа к stats по userId
        const statsMap = new Map();
        userDialogStatsList.forEach(stats => {
            const statsObj = stats;
            statsMap.set(statsObj.userId, {
                unreadCount: statsObj.unreadCount || 0
            });
        });
        const updates = allMemberUserIds.map((userId) => {
            // Получаем stats для текущего пользователя
            const userStats = statsMap.get(userId) || { unreadCount: 0 };
            // Клонируем dialog секцию и добавляем stats
            const dialogWithStats = {
                ...cloneSection(eventDialog),
                stats: userStats
            };
            const data = {
                dialog: dialogWithStats,
                context: cloneSection(context)
            };
            // Если в event.data есть member секция, добавляем её в update
            // Для dialog.member.add/remove/update member секция должна быть в event.data
            if (eventData.member) {
                data.member = cloneSection(eventData.member);
            }
            return {
                tenantId: tenantId,
                userId: userId,
                entityId: eventDialog.dialogId,
                eventId: eventIdString,
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
    }
    catch (error) {
        console.error('Error creating DialogUpdate:', error);
    }
}
/**
 * Формирует DialogMemberUpdate для конкретного участника диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export async function createDialogMemberUpdate(tenantId, dialogId, userId, eventId, eventType, eventData = {}) {
    try {
        // Преобразуем eventId в строковый формат (evt_...) для модели Update
        const eventIdString = await getEventIdString(eventId, tenantId);
        if (!eventIdString) {
            console.warn(`Cannot create DialogMemberUpdate: eventId "${eventId}" not found for tenant ${tenantId}`);
            return;
        }
        // Используем данные из event.data напрямую
        const eventDialog = eventData.dialog;
        const eventMember = eventData.member;
        let eventContext = eventData.context || {};
        // Секция dialog должна всегда присутствовать в event.data
        if (!eventDialog || !eventDialog.dialogId) {
            console.error(`Dialog section missing in event.data for event ${eventId} (${eventType}). This should not happen.`);
            return;
        }
        // Секция member должна присутствовать в event.data для dialog.member.update
        if (!eventMember) {
            console.error(`Member section missing in event.data for event ${eventId} (${eventType}). This should not happen.`);
            return;
        }
        // Используем context из event.data, если есть, иначе создаем минимальный
        const context = eventContext.eventType ? cloneSection(eventContext) : {
            eventType,
            dialogId: eventDialog.dialogId,
            entityId: eventDialog.dialogId,
            includedSections: ['dialog', 'member'],
            updatedFields: eventContext.updatedFields || []
        };
        // Получаем UserDialogStats для целевого пользователя
        const userDialogStats = await UserDialogStats.findOne({
            tenantId: tenantId,
            dialogId: eventDialog.dialogId,
            userId: userId
        }).lean();
        // Формируем stats секцию
        const statsObj = userDialogStats;
        const stats = statsObj ? {
            unreadCount: statsObj.unreadCount || 0
        } : { unreadCount: 0 };
        // Клонируем dialog секцию и добавляем stats
        const dialogWithStats = {
            ...cloneSection(eventDialog),
            stats: stats
        };
        const data = {
            dialog: dialogWithStats,
            member: cloneSection(eventMember),
            context
        };
        const updateData = {
            tenantId: tenantId,
            userId: userId,
            entityId: eventDialog.dialogId,
            eventId: eventIdString,
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
    }
    catch (error) {
        console.error('Error creating DialogMemberUpdate:', error);
    }
}
/**
 * Формирует MessageUpdate для всех участников диалога
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export async function createMessageUpdate(tenantId, dialogId, messageId, eventId, eventType, eventData = {}) {
    try {
        // Преобразуем eventId в строковый формат (evt_...) для модели Update
        const eventIdString = await getEventIdString(eventId, tenantId);
        if (!eventIdString) {
            console.warn(`Cannot create MessageUpdate: eventId "${eventId}" not found for tenant ${tenantId}`);
            return;
        }
        // Используем данные из event.data напрямую
        const eventDialog = eventData.dialog;
        let eventMessage = eventData.message || {};
        let eventContext = eventData.context || {};
        // Получаем topic для сообщения, если topicId указан
        // Если topic уже есть в eventData.message, используем его, иначе получаем из БД
        if (eventMessage.topicId && !eventMessage.topic) {
            try {
                const topic = await topicUtils.getTopicWithMeta(tenantId, dialogId, eventMessage.topicId);
                if (topic) {
                    eventMessage.topic = topic;
                }
                else {
                    eventMessage.topic = null;
                }
            }
            catch (error) {
                console.error('Error getting topic with meta for MessageUpdate:', error);
                eventMessage.topic = null;
            }
        }
        else if (!eventMessage.topicId) {
            eventMessage.topic = null;
        }
        // Секция dialog должна всегда присутствовать в event.data
        if (!eventDialog || !eventDialog.dialogId) {
            console.error(`Dialog section missing in event.data for event ${eventId} (${eventType}). This should not happen.`);
            return;
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
                const fullMessage = await buildFullMessagePayload(tenantId, message, senderCache);
                if (!fullMessage) {
                    console.error(`Failed to build message payload for ${messageId}`);
                    return;
                }
                eventMessage = fullMessage;
                eventMessage.dialogId = eventDialog.dialogId;
                // Получаем topic для сообщения, если topicId указан
                const messageObj = message;
                if (messageObj.topicId && !eventMessage.topic) {
                    try {
                        const topic = await topicUtils.getTopicWithMeta(tenantId, dialogId, messageObj.topicId);
                        eventMessage.topic = topic;
                        eventMessage.topicId = messageObj.topicId;
                    }
                    catch (error) {
                        console.error('Error getting topic with meta for MessageUpdate:', error);
                        eventMessage.topic = null;
                        eventMessage.topicId = messageObj.topicId;
                    }
                }
                else if (!messageObj.topicId) {
                    eventMessage.topic = null;
                    eventMessage.topicId = null;
                }
            }
            else {
                // Для других типов создаем минимальную структуру
                const messageObj = message;
                eventMessage = {
                    messageId: messageObj.messageId,
                    dialogId: eventDialog.dialogId,
                    senderId: messageObj.senderId,
                    type: messageObj.type,
                    topicId: messageObj.topicId || null
                };
                // Получаем topic для сообщения, если topicId указан
                if (messageObj.topicId && !eventMessage.topic) {
                    try {
                        const topic = await topicUtils.getTopicWithMeta(tenantId, dialogId, messageObj.topicId);
                        eventMessage.topic = topic;
                    }
                    catch (error) {
                        console.error('Error getting topic with meta for MessageUpdate:', error);
                        eventMessage.topic = null;
                    }
                }
                else if (!messageObj.topicId) {
                    eventMessage.topic = null;
                }
                // Добавляем данные из eventData, если есть
                if (eventData.message && eventData.message.statusUpdate) {
                    eventMessage.statusUpdate = eventData.message.statusUpdate;
                }
                else if (eventType.startsWith('message.status.') && eventData.userId) {
                    // Fallback для старого формата: { userId, newStatus, oldStatus }
                    eventMessage.statusUpdate = {
                        userId: eventData.userId,
                        status: eventData.newStatus,
                        oldStatus: eventData.oldStatus ?? null
                    };
                    // Для message.status.update нужно добавить statusMessageMatrix
                    const statusMessageMatrix = await buildStatusMessageMatrix(tenantId, messageId, messageObj.senderId);
                    eventMessage.statusMessageMatrix = statusMessageMatrix;
                }
                if (eventData.message && eventData.message.reactionUpdate) {
                    eventMessage.reactionUpdate = eventData.message.reactionUpdate;
                }
                else if (eventType.startsWith('message.reaction.') && eventData.userId) {
                    // Fallback для старого формата
                    eventMessage.reactionUpdate = {
                        userId: eventData.userId,
                        reaction: eventData.reaction,
                        oldReaction: eventData.oldReaction ?? null,
                        reactionSet: eventData.reactionSet ?? null
                    };
                }
                if (eventData.message && eventData.message.statusMessageMatrix) {
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
            dialogId: eventDialog.dialogId
        }).select('userId').lean();
        if (dialogMembers.length === 0) {
            console.log(`No active members found for dialog ${dialogId}`);
            return;
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
        // Получаем UserDialogStats для всех участников одним запросом
        const memberUserIds = dialogMembers.map(m => m.userId);
        const userDialogStatsList = await UserDialogStats.find({
            tenantId: tenantId,
            dialogId: eventDialog.dialogId,
            userId: { $in: memberUserIds }
        }).lean();
        // Создаем Map для быстрого доступа к stats по userId
        const statsMap = new Map();
        userDialogStatsList.forEach(stats => {
            const statsObj = stats;
            statsMap.set(statsObj.userId, {
                unreadCount: statsObj.unreadCount || 0
            });
        });
        const updates = dialogMembers.map(member => {
            const memberObj = member;
            // Получаем stats для текущего пользователя
            const userStats = statsMap.get(memberObj.userId) || { unreadCount: 0 };
            // Клонируем dialog секцию и добавляем stats
            const dialogWithStats = {
                ...cloneSection(eventDialog),
                stats: userStats
            };
            const data = {
                dialog: dialogWithStats,
                message: cloneSection(eventMessage),
                context: cloneSection(context)
            };
            // Если в event.data есть member секция, добавляем её в update
            // Для message.create/update member секция может быть в event.data
            if (eventData.member) {
                data.member = cloneSection(eventData.member);
            }
            return {
                tenantId: tenantId,
                userId: memberObj.userId,
                entityId: eventMessage.messageId,
                eventId: eventIdString,
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
    }
    catch (error) {
        console.error('Error creating MessageUpdate:', error);
    }
}
/**
 * Формирует TypingUpdate для всех участников диалога (кроме инициатора)
 * Использует данные из event.data напрямую, без перезагрузки из БД
 */
export async function createTypingUpdate(tenantId, dialogId, typingUserId, eventId, eventType, eventData = {}) {
    try {
        // Преобразуем eventId в строковый формат (evt_...) для модели Update
        const eventIdString = await getEventIdString(eventId, tenantId);
        if (!eventIdString) {
            console.warn(`Cannot create TypingUpdate: eventId "${eventId}" not found for tenant ${tenantId}`);
            return;
        }
        // Используем данные из event.data напрямую
        const eventDialog = eventData.dialog;
        const eventTyping = eventData.typing || {};
        let eventContext = eventData.context || {};
        // Секция dialog должна всегда присутствовать в event.data
        if (!eventDialog || !eventDialog.dialogId) {
            console.error(`Dialog section missing in event.data for event ${eventId} (${eventType}). This should not happen.`);
            return;
        }
        if (!eventContext.eventType) {
            eventContext = {
                eventType,
                dialogId: eventDialog.dialogId,
                entityId: eventDialog.dialogId,
                includedSections: eventData.member ? ['dialog', 'member', 'typing'] : ['dialog', 'typing']
            };
        }
        // Получаем всех участников диалога (единственное, что нужно загрузить из БД)
        const dialogMembers = await DialogMember.find({
            tenantId,
            dialogId: eventDialog.dialogId
        }).lean();
        if (dialogMembers.length === 0) {
            console.log(`No members found for typing update in dialog ${dialogId}`);
            return;
        }
        // Фильтруем участников, исключая инициатора
        const recipientMembers = dialogMembers.filter(member => member.userId !== typingUserId);
        if (recipientMembers.length === 0) {
            console.log(`No recipients found for typing update in dialog ${dialogId}`);
            return;
        }
        // Получаем UserDialogStats для всех получателей одним запросом
        const recipientUserIds = recipientMembers.map(m => m.userId);
        const userDialogStatsList = await UserDialogStats.find({
            tenantId: tenantId,
            dialogId: eventDialog.dialogId,
            userId: { $in: recipientUserIds }
        }).lean();
        // Создаем Map для быстрого доступа к stats по userId
        const statsMap = new Map();
        userDialogStatsList.forEach(stats => {
            const statsObj = stats;
            statsMap.set(statsObj.userId, {
                unreadCount: statsObj.unreadCount || 0
            });
        });
        // Используем typing данные из event.data
        // Поддерживаем как новый формат (eventData.typing), так и старый (плоские поля в eventData)
        const legacyTyping = eventData.typing ? {} : eventData;
        const typingSection = {
            userId: typingUserId,
            expiresInMs: eventTyping.expiresInMs ?? legacyTyping.expiresInMs ?? DEFAULT_TYPING_EXPIRES_MS,
            timestamp: eventTyping.timestamp ?? legacyTyping.timestamp ?? Date.now(),
            userInfo: eventTyping.userInfo ?? legacyTyping.userInfo ?? null
        };
        // Используем context из event.data, если есть, иначе создаем минимальный
        const context = eventContext.eventType ? cloneSection(eventContext) : {
            eventType,
            dialogId: eventDialog.dialogId,
            entityId: eventDialog.dialogId,
            includedSections: eventData.member ? ['dialog', 'member', 'typing'] : ['dialog', 'typing']
        };
        const updatesPayload = recipientMembers.map(member => {
            const memberObj = member;
            // Получаем stats для текущего пользователя
            const userStats = statsMap.get(memberObj.userId) || { unreadCount: 0 };
            // Клонируем dialog секцию и добавляем stats
            const dialogWithStats = {
                ...cloneSection(eventDialog),
                stats: userStats
            };
            const data = {
                dialog: dialogWithStats,
                typing: typingSection,
                context: cloneSection(context)
            };
            // Если в event.data есть member секция, добавляем её в update
            if (eventData.member) {
                data.member = cloneSection(eventData.member);
            }
            return {
                tenantId,
                userId: memberObj.userId,
                entityId: eventDialog.dialogId,
                eventId: eventIdString,
                eventType,
                data,
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
    }
    catch (error) {
        console.error('Error creating TypingUpdate:', error);
    }
}
/**
 * Создает UserStatsUpdate - update со статистикой пользователя (dialogCount, unreadDialogsCount)
 */
export async function createUserStatsUpdate(tenantId, userId, sourceEventId, sourceEventType, updatedFields = []) {
    try {
        // Преобразуем sourceEventId в строковый формат (evt_...) для модели Update
        const eventIdString = await getEventIdString(sourceEventId, tenantId);
        if (!eventIdString) {
            return;
        }
        // Получаем статистику пользователя из UserStats (новая архитектура)
        let stats = await UserStats.findOne({ tenantId, userId }).lean();
        // Если UserStats не существует, возвращаем значения по умолчанию
        // Это может произойти если счетчики еще не были инициализированы
        const statsObj = stats;
        if (!statsObj) {
            stats = {
                dialogCount: 0,
                unreadDialogsCount: 0,
                totalUnreadCount: 0,
                totalMessagesCount: 0
            };
        }
        // Получаем данные пользователя
        const user = await User.findOne({ userId, tenantId }).lean();
        if (!user) {
            console.warn(`User ${userId} not found for stats update`);
            return;
        }
        // Получаем мета-теги пользователя
        const userMeta = await metaUtils.getEntityMeta(tenantId, 'user', userId);
        const userObj = user;
        const finalStats = statsObj || {
            dialogCount: 0,
            unreadDialogsCount: 0,
            totalUnreadCount: 0,
            totalMessagesCount: 0
        };
        // Создаем секцию user со статистикой
        const userSection = eventUtils.buildUserSection({
            userId: userObj.userId,
            type: userObj.type || null,
            meta: userMeta || {},
            stats: {
                dialogCount: finalStats.dialogCount || 0,
                unreadDialogsCount: finalStats.unreadDialogsCount || 0,
                totalUnreadCount: finalStats.totalUnreadCount || 0,
                totalMessagesCount: finalStats.totalMessagesCount || 0
            }
        });
        // Создаем context для UserStatsUpdate
        // Используем 'user.update' как базовый тип, т.к. 'user.stats.update' не входит в EventType
        const context = eventUtils.buildEventContext({
            eventType: 'user.update',
            entityId: userId,
            includedSections: ['user'],
            updatedFields: updatedFields.length > 0 ? updatedFields : [
                'user.stats.dialogCount', 'user.stats.unreadDialogsCount'
            ]
        });
        // Создаем update
        const update = {
            tenantId: tenantId,
            userId: userId,
            entityId: userId,
            eventId: eventIdString,
            eventType: 'user.stats.update',
            data: {
                user: cloneSection(userSection),
                context: cloneSection(context)
            },
            published: false
        };
        // Сохраняем update в БД
        const savedUpdate = await Update.create(update);
        // Публикуем update в RabbitMQ асинхронно
        await publishUpdate(savedUpdate).catch(err => {
            console.error(`Error publishing user stats update ${savedUpdate._id}:`, err);
        });
        console.log(`Created UserStatsUpdate for user ${userId} from event ${sourceEventId}`);
    }
    catch (error) {
        console.error('Error creating UserStatsUpdate:', error);
    }
}
/**
 * Создает UserUpdate для события user.*
 */
export async function createUserUpdate(tenantId, userId, eventId, eventType, eventData) {
    try {
        // Преобразуем eventId в строковый формат (evt_...) для модели Update
        const eventIdString = await getEventIdString(eventId, tenantId);
        if (!eventIdString) {
            console.warn(`Cannot create UserUpdate: eventId "${eventId}" not found for tenant ${tenantId}`);
            return;
        }
        const eventContext = eventData.context || {};
        const eventUser = (eventData.user || {});
        if (!eventUser.userId) {
            console.error(`No user data in event ${eventId}`);
            return;
        }
        // Используем context из event.data, если есть, иначе создаем минимальный
        const context = eventContext.eventType ? cloneSection(eventContext) : {
            eventType,
            entityId: userId,
            includedSections: ['user']
        };
        const update = {
            tenantId: tenantId,
            userId: userId,
            entityId: userId,
            eventId: eventIdString,
            eventType: eventType,
            data: {
                user: cloneSection(eventUser),
                context: cloneSection(context)
            },
            published: false
        };
        // Сохраняем update в БД
        const savedUpdate = await Update.create(update);
        // Публикуем update в RabbitMQ асинхронно
        await publishUpdate(savedUpdate).catch(err => {
            console.error(`Error publishing user update ${savedUpdate._id}:`, err);
        });
        console.log(`Created UserUpdate for user ${userId} from event ${eventId}`);
    }
    catch (error) {
        console.error('Error creating UserUpdate:', error);
    }
}
/**
 * Публикует update в RabbitMQ
 */
async function publishUpdate(update) {
    try {
        const updateObj = update.toObject
            ? update.toObject()
            : update;
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
        // Определяем категорию update (dialog или user)
        const dialogUpdates = ['DialogUpdate', 'DialogMemberUpdate', 'MessageUpdate', 'TypingUpdate'];
        const category = dialogUpdates.includes(updateType) ? 'dialog' : 'user';
        // Публикуем в exchange (из конфига RABBITMQ_UPDATES_EXCHANGE или по умолчанию chat3_updates)
        // с routing key update.{category}.{type}.{userId}.{updateType}
        const routingKey = `update.${category}.${userType}.${sanitizedUpdate.userId}.${updateType.toLowerCase()}`;
        // Получаем имя exchange из rabbitmqUtils (читает из process.env.RABBITMQ_UPDATES_EXCHANGE)
        const rabbitMQInfo = rabbitmqUtils.getRabbitMQInfo();
        const exchangeName = rabbitMQInfo?.updatesExchange || 'chat3_updates';
        const published = await rabbitmqUtils.publishUpdate(sanitizedUpdate, routingKey);
        if (!published) {
            console.error(`❌ Failed to publish update ${updateId} to RabbitMQ (exchange: ${exchangeName}, routing key: ${routingKey})`);
            throw new Error('Failed to publish update to RabbitMQ');
        }
        // Обновляем статус published только если публикация успешна
        await Update.updateOne({ _id: updateId }, {
            $set: {
                published: true,
                publishedAt: generateTimestamp()
            }
        });
        console.log(`✅ Update ${updateId} published to RabbitMQ (exchange: ${exchangeName}, routing key: ${routingKey})`);
    }
    catch (error) {
        const updateId = update._id || (update.toObject ? update.toObject()._id : null);
        console.error(`❌ Error publishing update ${updateId}:`, error instanceof Error ? error.message : String(error));
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
        return 'TypingUpdate';
    }
    if (USER_UPDATE_EVENTS.includes(eventType)) {
        return 'UserUpdate';
    }
    if (eventType === 'user.stats.update') {
        return 'UserStatsUpdate';
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
        typing: TYPING_EVENTS.includes(eventType),
        user: USER_UPDATE_EVENTS.includes(eventType)
    };
}
//# sourceMappingURL=updateUtils.js.map