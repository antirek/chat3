 
import { Message, MessageVersion, Dialog, MessageStatus, User, DialogMember } from '@chat3/models';
import * as metaUtils from '@chat3/utils/metaUtils.js';
import * as eventUtils from '@chat3/utils/eventUtils.js';
import * as topicUtils from '@chat3/utils/topicUtils.js';
import { parseFilters, buildFilterQuery } from '@chat3/utils/queryParser.js';
import { sanitizeResponse } from '@chat3/utils/responseUtils.js';
import { generateTimestamp } from '@chat3/utils/timestampUtils.js';
import { buildStatusMessageMatrix, buildReactionSet } from '@chat3/utils/userDialogUtils.js';
import { updateLastMessageAt } from '../utils/dialogMemberUtils.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/apiAuth.js';
import { getSenderInfo, enrichMessagesWithMetaAndStatuses } from '../utils/messageEnrichment.js';
import {
  setMessageDeleted,
  sendMessage,
  isAppServiceError,
  appServiceErrorToHttpStatus,
  appServiceErrorToHttpBody
} from '@chat3/app-services';

const messageController = {
  // Get all messages with filtering and pagination
  async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /messages/';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '10')) || 10;
      const skip = (page - 1) * limit;
      log(`Получены параметры: page=${page}, limit=${limit}, filter=${req.query.filter || 'нет'}, sort=${req.query.sort || 'нет'}`);

      // Build base query
      let query: Record<string, unknown> = {
        tenantId: req.tenantId!
      };

      // Parse sort parameter
      let sortOptions = { createdAt: -1 }; // Default sort by newest first
      if (req.query.sort) {
        console.log('Sort parameter:', req.query.sort);
        // Parse sort string like "(createdAt,asc)" or "(createdAt,desc)"
        const sortMatch = String(req.query.sort).match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2];
          console.log(`Sorting by ${field} ${direction}`);
          sortOptions = { [field]: direction === 'asc' ? 1 : -1 } as any;
        }
      }
      console.log('Sort options:', sortOptions);

      // Apply filters if provided
      if (req.query.filter) {
        try {
          const parsedFilters = parseFilters(String(req.query.filter));
          const filterQuery = await buildFilterQuery(req.tenantId!, 'message', parsedFilters);
          Object.assign(query, filterQuery);
        } catch (err: any) {
          res.status(400).json({
            error: 'Bad Request',
            message: err?.message || 'Invalid filter format'
          });
          return;
        }
      }

      // Get messages with pagination
      const messages = await Message.find(query)
        .select('messageId dialogId senderId content type createdAt deleted deletedAt deletedBy edited editedAt editedBy')
        .sort(sortOptions as any)
        .skip(skip)
        .limit(limit);

      // Add meta data and message statuses for each message
      const messagesWithMeta = await enrichMessagesWithMetaAndStatuses(messages, req.tenantId);

      const total = await Message.countDocuments(query);
      log(`Всего сообщений: ${total}, найдено: ${messagesWithMeta.length}, страница: ${page}, лимит: ${limit}`);

      log(`Отправка ответа: ${messagesWithMeta.length} сообщений`);
      res.json({
        data: sanitizeResponse(messagesWithMeta),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      console.error('Error in getAll:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },
  // Get messages for a specific dialog
  async getDialogMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /dialogs/:dialogId/messages';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId } = req.params;
      log(`Получены параметры: dialogId=${dialogId}, page=${req.query.page || 'нет'}, limit=${req.query.limit || 'нет'}`);
      const page = parseInt(String(req.query.page || '1')) || 1;
      const limit = parseInt(String(req.query.limit || '10')) || 10;
      const skip = (page - 1) * limit;

      // Check if dialog exists and belongs to tenant
      const dialog = await Dialog.findOne({
        dialogId: dialogId,
        tenantId: req.tenantId!
      });

      if (!dialog) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Dialog not found'
        });
        return;
      }

      // Parse filters if provided
      let query: any = {
        tenantId: req.tenantId!,
        dialogId: dialog.dialogId // Используем строковый dialogId для поиска сообщений
      };

      if (req.query.filter) {
        try {
          const parsedFilters = parseFilters(String(req.query.filter));
          const filterQuery = await buildFilterQuery(req.tenantId!, 'message', parsedFilters);
          Object.assign(query, filterQuery);
          // Обработка фильтра по topicId (если есть в query после buildFilterQuery)
          if (query.topicId === 'null') {
            query.topicId = null;
          }
        } catch (err: any) {
          res.status(400).json({
            error: 'Bad Request',
            message: err?.message || 'Invalid filter format'
          });
          return;
        }
      }

      // Apply sorting
      let sortOptions = { createdAt: -1 }; // Default sort by newest first
      if (req.query.sort) {
        // Parse sort parameter in format (field,direction)
        const sortMatch = String(req.query.sort).match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2];
          console.log('Message sorting by:', field, direction);
          
          if (field === 'createdAt') {
            sortOptions = { createdAt: direction === 'asc' ? 1 : -1 };
          } else if (field === 'senderId') {
            sortOptions = { senderId: direction === 'asc' ? 1 : -1 } as any;
          } else {
            console.log('Unknown sort field:', field, 'using default');
          }
        } else {
          console.log('Invalid sort format:', req.query.sort);
        }
      }

      log(`Выполнение запроса сообщений: skip=${skip}, limit=${limit}, sort=${JSON.stringify(sortOptions)}`);
      const messages = await Message.find(query)
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .populate('tenantId', 'name domain')
        .sort(sortOptions as any);
      log(`Найдено сообщений: ${messages.length}`);

      // Add meta data and message statuses for each message
      // Передаем dialogId для батчинга топиков
      log(`Обогащение сообщений метаданными и статусами: ${messages.length} сообщений`);
      const messagesWithMeta = await enrichMessagesWithMetaAndStatuses(messages, req.tenantId, { dialogId: dialog.dialogId });

      const total = await Message.countDocuments(query);
      log(`Всего сообщений: ${total}, страница: ${page}, лимит: ${limit}`);

      log(`Отправка ответа: ${messagesWithMeta.length} сообщений`);
      res.json({
        data: sanitizeResponse(messagesWithMeta),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (error.name === 'CastError') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid dialog ID'
        });
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Create new message in dialog
  async createMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'post /dialogs/:dialogId/messages';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { dialogId } = req.params;
      const { content, senderId, type = 'internal.text', meta, quotedMessageId, topicId } = req.body;
      log(`Получены параметры: dialogId=${dialogId}, senderId=${senderId}, type=${type}, topicId=${topicId || 'нет'}, quotedMessageId=${quotedMessageId || 'нет'}`);

      const result = await sendMessage({
        tenantId: req.tenantId!,
        dialogId,
        userId: senderId,
        content,
        type,
        meta,
        quotedMessageId,
        topicId
      });

      log(`Отправка успешного ответа: messageId=${result.message?.messageId}, dialogId=${dialogId}`);
      res.status(201).json({
        data: result.message,
        message: 'Message created successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (isAppServiceError(error)) {
        if (error.message === 'Topic not found') {
          res.status(404).json({
            error: 'ERROR_NO_TOPIC',
            message: 'Topic not found'
          });
          return;
        }
        res.status(appServiceErrorToHttpStatus(error)).json(appServiceErrorToHttpBody(error));
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Get message by ID
  async getMessageById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /messages/:messageId';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const rawMessageId = req.params.messageId;
      const messageId = typeof rawMessageId === 'string' ? rawMessageId.trim().toLowerCase() : rawMessageId;
      const tenantId = req.tenantId!;
      log(`Получены параметры: messageId=${messageId}, tenantId=${tenantId}`);

      log(`Поиск сообщения: messageId=${messageId}, tenantId=${tenantId}`);
      const message = await Message.findOne({
        messageId,
        tenantId
      });

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found. Check that the message exists and that X-TENANT-ID (or API key tenant) matches the tenant where the message was created.'
        });
        return;
      }
      log(`Сообщение найдено: messageId=${message.messageId}, dialogId=${message.dialogId}`);

      log(`Получение метаданных сообщения: messageId=${message.messageId}`);
      // Получаем метаданные сообщения
      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message.messageId
      );

      const messageObj = message.toObject();
      
      // Получаем топик с метаданными, если topicId указан
      let topic = null;
      // Явно получаем topicId из документа (может быть null или undefined)
      const messageTopicId = (message as any).topicId || (messageObj as any).topicId || null;
      
      if (messageTopicId) {
        log(`Получение топика: topicId=${messageTopicId}`);
        try {
          topic = await topicUtils.getTopicWithMeta(req.tenantId, message.dialogId, messageTopicId);
        } catch (error) {
          console.error('Error getting topic with meta:', error);
          topic = { topicId: messageTopicId, meta: {} };
        }
      }
      
      log(`Формирование статусов и реакций: messageId=${message.messageId}`);
      // Формируем матрицу статусов (исключая статусы отправителя сообщения)
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, messageObj.senderId);
      
      // Формируем reactionSet (без currentUserId, так как это общий эндпоинт)
      const reactionSet = await buildReactionSet(req.tenantId, message.messageId, null);

      const senderInfo = await getSenderInfo(req.tenantId, message.senderId);
      
      // dialogId теперь уже строка в формате dlg_, не нужно преобразовывать

      log(`Отправка ответа: messageId=${message.messageId}`);
      res.json({
        data: sanitizeResponse({
          ...messageObj,
          topicId: messageTopicId, // Явно устанавливаем topicId (может быть null)
          statusMessageMatrix,
          reactionSet,
          meta,
          topic: topic || null,
          senderInfo: senderInfo || null
        })
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Update message content (PUT /api/messages/:messageId/edit; legacy PUT /:messageId)
  async updateMessageContent(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'put /messages/:messageId/edit';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    }
    log('>>>>> start');
    
    try {
      const { messageId } = req.params;
      const { content, editedBy: editedByRaw } = req.body;
      const editedBy =
        typeof editedByRaw === 'string' && editedByRaw.trim().length > 0
          ? editedByRaw.trim()
          : null;
      log(`Получены параметры: messageId=${messageId}, content=${content ? 'есть' : 'нет'}, editedBy=${editedBy ?? 'null'}`);

      log(`Поиск сообщения: messageId=${messageId}, tenantId=${req.tenantId}`);
      const message = await Message.findOne({
        messageId,
        tenantId: req.tenantId!
      });

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }
      log(`Сообщение найдено: messageId=${message.messageId}, type=${message.type}`);

      const newContent = typeof content === 'string' ? content : '';

      if (message.type === 'internal.text' && newContent.trim().length === 0) {
        log(`Ошибка валидации: пустой content для internal.text`);
        res.status(400).json({
          error: 'Bad Request',
          message: 'content is required for internal.text messages'
        });
        return;
      }

      const oldContent = message.content;
      if (oldContent === newContent) {
        log(`Содержимое не изменилось: messageId=${message.messageId}`);
        const meta = await metaUtils.getEntityMeta(
          req.tenantId,
          'message',
          message.messageId
        );

        const messageObj = message.toObject();
        const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, messageObj.senderId);
        const reactionSet = await buildReactionSet(req.tenantId, message.messageId, null);
        const senderInfo = await getSenderInfo(req.tenantId, message.senderId);

        res.json({
          data: sanitizeResponse({
            ...messageObj,
            statusMessageMatrix,
            reactionSet,
            meta,
            senderInfo: senderInfo || null
          }),
          message: 'Message content is unchanged'
        });
        return;
      }

      const editedAt = generateTimestamp();

      // Архив предыдущего content (первая версия — только при первой успешной правке)
      const lastVersion = await MessageVersion.findOne({
        tenantId: req.tenantId!,
        messageId: message.messageId
      })
        .sort({ versionIndex: -1 })
        .select('versionIndex')
        .lean();
      const versionIndex = (lastVersion?.versionIndex ?? 0) + 1;

      log(`Создание MessageVersion #${versionIndex}: messageId=${message.messageId}`);
      await MessageVersion.create({
        tenantId: req.tenantId!,
        messageId: message.messageId,
        versionIndex,
        content: oldContent,
        editedBy,
        createdAt: editedAt
      });

      log(`Обновление содержимого сообщения: messageId=${message.messageId}`);
      message.content = newContent;
      message.edited = true;
      message.editedAt = editedAt;
      message.editedBy = editedBy;
      await message.save();
      log(`Сообщение обновлено: messageId=${message.messageId}, editedAt=${editedAt}`);

      const meta = await metaUtils.getEntityMeta(
        req.tenantId,
        'message',
        message.messageId
      );

      log(`Получение диалога для события: dialogId=${message.dialogId}`);
      const dialog = await Dialog.findOne({
        dialogId: message.dialogId,
        tenantId: req.tenantId!
      }).lean();

      let dialogSection = null;
      if (dialog) {
        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId, 'dialog', dialog.dialogId);
        dialogSection = eventUtils.buildDialogSection({
          dialogId: dialog.dialogId,
          tenantId: dialog.tenantId,
          createdAt: dialog.createdAt,
          meta: dialogMeta || {}
        });
      }

      const MAX_CONTENT_LENGTH = 4096;
      const eventContent = newContent.length > MAX_CONTENT_LENGTH
        ? newContent.substring(0, MAX_CONTENT_LENGTH)
        : newContent;

      let topicForEvent: any = null;
      const messageTopicIdForEvent = (message as any).topicId;
      if (messageTopicIdForEvent) {
        try {
          topicForEvent = await topicUtils.getTopicWithMeta(req.tenantId, message.dialogId, messageTopicIdForEvent);
        } catch (error) {
          console.error('Error getting topic with meta for event:', error);
          topicForEvent = { topicId: messageTopicIdForEvent, meta: {} };
        }
      }

      const messageSection = eventUtils.buildMessageSection({
        messageId: message.messageId,
        dialogId: message.dialogId,
        senderId: message.senderId,
        type: message.type,
        content: eventContent,
        meta: meta || {},
        topicId: messageTopicIdForEvent || null,
        topic: topicForEvent,
        edited: message.edited,
        editedAt: message.editedAt,
        editedBy: message.editedBy
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'message.changed',
        dialogId: message.dialogId,
        entityId: message.messageId,
        messageId: message.messageId,
        includedSections: dialogSection ? ['dialog', 'message'] : ['message'],
        updatedFields: ['message.content']
      });

      log(`Создание события message.changed: messageId=${message.messageId}`);
      await eventUtils.createEvent({
        tenantId: req.tenantId!,
        eventType: 'message.changed',
        entityType: 'message',
        entityId: message.messageId,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          message: messageSection,
          extra: {
            delta: {
              content: {
                from: oldContent,
                to: newContent
              }
            }
          }
        })
      });

      const messageObj = message.toObject();
      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId, message.messageId, messageObj.senderId);
      const reactionSet = await buildReactionSet(req.tenantId, message.messageId, null);
      const senderInfo = await getSenderInfo(req.tenantId, message.senderId);

      log(`Отправка успешного ответа: messageId=${message.messageId}`);
      res.json({
        data: sanitizeResponse({
          ...messageObj,
          statusMessageMatrix,
          reactionSet,
          meta,
          senderInfo: senderInfo || null
        }),
        message: 'Message content updated successfully'
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  /**
   * История версий content (последние 20, свежие → старые).
   * GET /api/messages/:messageId/versions — permission read.
   */
  async getMessageVersions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'get /messages/:messageId/versions';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');

    try {
      const { messageId } = req.params;
      const message = await Message.findOne({
        messageId,
        tenantId: req.tenantId!
      }).select('messageId');

      if (!message) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }

      const versions = await MessageVersion.find({
        tenantId: req.tenantId!,
        messageId
      })
        .sort({ versionIndex: -1 })
        .limit(20)
        .select('messageId tenantId versionIndex content editedBy createdAt -_id')
        .lean();

      log(`Версий: ${versions.length}`);
      res.json({
        data: sanitizeResponse(versions)
      });
    } catch (error: any) {
      log(`Ошибка:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  /**
   * Установка или сброс топика сообщения (PATCH /api/messages/:messageId/topic).
   * Вариант 1.3: установить topicId (если у сообщения нет топика) или сбросить в null (если есть).
   * Нельзя менять один топик на другой (A → B). topicId должен быть в том же dialogId, что и сообщение.
   */
  async updateMessageTopic(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'patch /messages/:messageId/topic';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');

    try {
      const { messageId } = req.params;
      let { topicId: topicIdPayload } = req.body as { topicId: string | null };
      const normalizedTopicId = topicIdPayload !== undefined && topicIdPayload !== null && String(topicIdPayload).trim() !== ''
        ? String(topicIdPayload).trim().toLowerCase()
        : null;
      log(`Получены параметры: messageId=${messageId}, topicId=${normalizedTopicId ?? 'null'}`);

      const message = await Message.findOne({
        messageId,
        tenantId: req.tenantId!
      });

      if (!message) {
        log(`Сообщение не найдено: messageId=${messageId}`);
        res.status(404).json({
          error: 'Not Found',
          message: 'Message not found'
        });
        return;
      }

      const currentTopicId = (message as any).topicId ?? null;

      if (normalizedTopicId !== null) {
        // Установка топика: разрешено только если у сообщения ещё нет топика
        if (currentTopicId !== null) {
          log(`Ошибка: сообщение уже привязано к топику topicId=${currentTopicId}`);
          res.status(400).json({
            error: 'Bad Request',
            message: 'Cannot set topic: message already has a topic. Clear it first or use a different message.',
            code: 'ERROR_TOPIC_CHANGE_NOT_ALLOWED'
          });
          return;
        }
        const topic = await topicUtils.getTopicById(req.tenantId!, message.dialogId, normalizedTopicId);
        if (!topic) {
          log(`Топик не найден или не в этом диалоге: topicId=${normalizedTopicId}, dialogId=${message.dialogId}`);
          res.status(404).json({
            error: 'Not Found',
            message: 'Topic not found or not in the same dialog as the message',
            code: 'ERROR_TOPIC_NOT_FOUND'
          });
          return;
        }
        (message as any).topicId = normalizedTopicId;
      } else {
        // Сброс топика: разрешено только если у сообщения есть топик
        if (currentTopicId === null) {
          log(`Ошибка: у сообщения нет топика`);
          res.status(400).json({
            error: 'Bad Request',
            message: 'Cannot clear topic: message has no topic.',
            code: 'ERROR_TOPIC_CLEAR_NOT_ALLOWED'
          });
          return;
        }
        (message as any).topicId = null;
      }

      await message.save();
      log(`Обновлён topicId сообщения: messageId=${message.messageId}, topicId=${(message as any).topicId ?? 'null'}`);

      const meta = await metaUtils.getEntityMeta(req.tenantId!, 'message', message.messageId);
      const messageObj = message.toObject();
      const messageTopicIdForEvent = (message as any).topicId ?? null;
      let topicForEvent: any = null;
      if (messageTopicIdForEvent) {
        try {
          topicForEvent = await topicUtils.getTopicWithMeta(req.tenantId!, message.dialogId, messageTopicIdForEvent);
        } catch {
          topicForEvent = { topicId: messageTopicIdForEvent, meta: {} };
        }
      }

      const dialog = await Dialog.findOne({
        dialogId: message.dialogId,
        tenantId: req.tenantId!
      }).lean();
      let dialogSection: any = null;
      if (dialog) {
        const dialogMeta = await metaUtils.getEntityMeta(req.tenantId!, 'dialog', message.dialogId);
        dialogSection = eventUtils.buildDialogSection({
          dialogId: (dialog as any).dialogId,
          tenantId: (dialog as any).tenantId,
          createdAt: (dialog as any).createdAt,
          meta: dialogMeta || {}
        });
      }

      const messageSection = eventUtils.buildMessageSection({
        messageId: message.messageId,
        dialogId: message.dialogId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        meta: meta || {},
        topicId: messageTopicIdForEvent,
        topic: topicForEvent
      });

      const eventContext = eventUtils.buildEventContext({
        eventType: 'message.changed',
        dialogId: message.dialogId,
        entityId: message.messageId,
        messageId: message.messageId,
        includedSections: dialogSection ? ['dialog', 'message'] : ['message'],
        updatedFields: ['message.topicId']
      });

      await eventUtils.createEvent({
        tenantId: req.tenantId!,
        eventType: 'message.changed',
        entityType: 'message',
        entityId: message.messageId,
        actorId: req.apiKey?.name || 'unknown',
        actorType: 'api',
        data: eventUtils.composeEventData({
          context: eventContext,
          dialog: dialogSection,
          message: messageSection
        })
      });

      const statusMessageMatrix = await buildStatusMessageMatrix(req.tenantId!, message.messageId, messageObj.senderId);
      const reactionSet = await buildReactionSet(req.tenantId!, message.messageId, null);
      const senderInfo = await getSenderInfo(req.tenantId!, message.senderId);
      const topicForResponse = topicForEvent || null;

      const data = sanitizeResponse({
        ...messageObj,
        topicId: messageTopicIdForEvent,
        statusMessageMatrix,
        reactionSet,
        meta,
        topic: topicForResponse,
        senderInfo: senderInfo || null
      }) as Record<string, unknown>;
      // sanitizeResponse убирает поля со значением null; для сброса топика клиенту нужны явные topicId: null, topic: null
      if (messageTopicIdForEvent === null) data.topicId = null;
      if (topicForResponse === null) data.topic = null;

      res.json({
        data,
        message: 'Message topic updated successfully'
      });
    } catch (error: any) {
      console.error(`[${routePath}] Error:`, error.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  /**
   * Soft-delete / undelete сообщения (PATCH /api/messages/:messageId).
   * Body: { deleted: boolean, deletedBy?: string }.
   * Идемпотентно: если флаг уже равен целевому — 200 без Event.
   */
  async patchMessageDeleted(req: AuthenticatedRequest, res: Response): Promise<void> {
    const routePath = 'patch /messages/:messageId';
    const log = (...args: any[]) => {
      console.log(`[${routePath}]`, ...args);
    };
    log('>>>>> start');

    try {
      const { messageId } = req.params;
      const { deleted, deletedBy: deletedByRaw } = req.body as {
        deleted: boolean;
        deletedBy?: string | null;
      };
      log(`Получены параметры: messageId=${messageId}, deleted=${deleted}, deletedBy=${deletedByRaw ?? 'null'}`);

      const result = await setMessageDeleted({
        tenantId: req.tenantId!,
        messageId,
        deleted: deleted === true,
        deletedBy: deletedByRaw,
        actorId: req.apiKey?.name || 'unknown'
      });

      res.json({
        data: result.message,
        message: result.responseMessage
      });
    } catch (error: any) {
      log(`Ошибка обработки запроса:`, error.message);
      if (isAppServiceError(error)) {
        res.status(appServiceErrorToHttpStatus(error)).json(appServiceErrorToHttpBody(error));
        return;
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    } finally {
      log('>>>>> end');
    }
  },

  // Get events for a message
};

export default messageController;
