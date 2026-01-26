import { Dialog, Message, Event, Update } from '@chat3/models';
import { Request, Response } from 'express';

export const eventsController = {
  // Get events for a dialog
  async getDialogEvents(req: Request, res: Response): Promise<void> {
    try {
      const { dialogId } = req.params;
      const tenantId = (req.query.tenantId as string) || req.headers['x-tenant-id'] as string;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!tenantId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
        return;
      }

      // Проверяем, существует ли диалог
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId
      }).lean();

      if (!dialog) {
        res.status(404).json({
          error: 'Not Found',
          message: `Dialog with ID ${dialogId} not found`
        });
        return;
      }

      // Получаем все события, связанные с этим диалогом
      // События могут иметь разные entityType: 'dialog', 'dialogMember'
      // но все они имеют entityId = dialogId
      const events = await Event.find({
        tenantId,
        entityId: dialogId,
        entityType: { $in: ['dialog', 'dialogMember'] }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Для каждого события получаем количество обновлений
      const eventsWithUpdates = await Promise.all(
        events.map(async (event) => {
          try {
            const updatesCount = await Update.countDocuments({
              tenantId,
              eventId: event._id
            });
            return {
              ...event,
              updatesCount
            };
          } catch (_err) {
            return {
              ...event,
              updatesCount: 0
            };
          }
        })
      );

      res.json({
        data: eventsWithUpdates
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get updates for a dialog
  async getDialogUpdates(req: Request, res: Response): Promise<void> {
    try {
      const { dialogId } = req.params;
      const tenantId = (req.query.tenantId as string) || req.headers['x-tenant-id'] as string;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!tenantId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
        return;
      }

      // Проверяем, существует ли диалог
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId
      }).lean();

      if (!dialog) {
        res.status(404).json({
          error: 'Not Found',
          message: `Dialog with ID ${dialogId} not found`
        });
        return;
      }

      // Получаем все обновления для этого диалога
      // Обновления имеют entityId = dialogId
      const updates = await Update.find({
        tenantId,
        entityId: dialogId
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      console.log(`[getDialogUpdates] Найдено обновлений: ${updates.length}`);
      if (updates.length > 0) {
        console.log(`[getDialogUpdates] Первое обновление (до преобразования):`, {
          userId: updates[0].userId,
          eventType: updates[0].eventType,
          eventId: updates[0].eventId,
          eventIdType: typeof updates[0].eventId,
          hasEventId: !!updates[0].eventId
        });
      }

      // Выбираем нужные поля и преобразуем eventId в строку для корректной сериализации JSON
      const updatesWithStringEventId = updates.map(update => {
        const eventId = update.eventId;
        
        // Преобразуем eventId в строку
        let eventIdStr: string | null = null;
        if (eventId) {
          if (typeof eventId === 'object') {
            // Если это объект (ObjectId), используем toString
            try {
              eventIdStr = (eventId as { toString: () => string }).toString();
            } catch {
              eventIdStr = null;
            }
          } else {
            // Иначе преобразуем в строку
            eventIdStr = String(eventId);
          }
        }
        
        return {
          userId: update.userId,
          eventType: update.eventType,
          createdAt: update.createdAt,
          eventId: eventIdStr
        };
      });

      if (updatesWithStringEventId.length > 0) {
        console.log(`[getDialogUpdates] Первое обновление (после преобразования):`, updatesWithStringEventId[0]);
      }

      res.json({
        data: updatesWithStringEventId
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get events for a message
  async getMessageEvents(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const tenantId = (req.query.tenantId as string) || req.headers['x-tenant-id'] as string;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!tenantId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
        return;
      }

      // Получаем все события, связанные с этим сообщением
      // События могут иметь разные entityType: 'message', 'messageReaction', 'messageStatus'
      // но все они имеют entityId = messageId
      const events = await Event.find({
        tenantId,
        entityId: messageId,
        entityType: { $in: ['message', 'messageReaction', 'messageStatus'] }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Для каждого события получаем количество обновлений
      const eventsWithUpdates = await Promise.all(
        events.map(async (event) => {
          try {
            const updatesCount = await Update.countDocuments({
              tenantId,
              eventId: event._id
            });
            return {
              ...event,
              updatesCount
            };
          } catch (_err) {
            return {
              ...event,
              updatesCount: 0
            };
          }
        })
      );

      res.json({
        data: eventsWithUpdates
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get updates for a message
  async getMessageUpdates(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const tenantId = (req.query.tenantId as string) || req.headers['x-tenant-id'] as string;
      const limit = parseInt(req.query.limit as string) || 100;

      if (!tenantId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
        return;
      }

      // Проверяем, существует ли сообщение
      const message = await Message.findOne({
        messageId,
        tenantId
      }).lean();

      if (!message) {
        res.status(404).json({
          error: 'Not Found',
          message: `Message with ID ${messageId} not found`
        });
        return;
      }

      // Получаем все обновления для этого сообщения
      // Обновления имеют entityId = messageId
      const updates = await Update.find({
        tenantId,
        entityId: messageId
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('userId eventType createdAt eventId')
        .lean();

      // Преобразуем eventId в строку для корректной сериализации JSON
      const updatesWithStringEventId = updates.map(update => ({
        ...update,
        eventId: update.eventId ? String(update.eventId) : null
      }));

      res.json({
        data: updatesWithStringEventId
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get all events with pagination
  async getAllEvents(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req.query.tenantId as string) || req.headers['x-tenant-id'] as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      if (!tenantId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
        return;
      }

      // Build filter
      const filter: any = { tenantId };
      
      // Optional filters
      if (req.query.eventType) {
        filter.eventType = req.query.eventType;
      }
      if (req.query.entityType) {
        filter.entityType = req.query.entityType;
      }
      if (req.query.entityId) {
        filter.entityId = req.query.entityId;
      }
      if (req.query.actorId) {
        filter.actorId = req.query.actorId;
      }

      // Get total count
      const total = await Event.countDocuments(filter);

      // Формируем сортировку
      let sortOptions: Record<string, 1 | -1> = { createdAt: -1 }; // По умолчанию
      if (req.query.sort) {
        const sortParam = String(req.query.sort);
        // Формат: (field,direction)
        const match = sortParam.match(/\(([^,]+),([^)]+)\)/);
        if (match) {
          const field = match[1].trim();
          const direction = match[2].trim().toLowerCase();
          sortOptions = {};
          sortOptions[field] = direction === 'asc' ? 1 : -1;
        }
      }

      // Get events with pagination
      const events = await Event.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // For each event, get updates count
      const eventsWithUpdates = await Promise.all(
        events.map(async (event) => {
          try {
            const updatesCount = await Update.countDocuments({
              tenantId,
              eventId: event._id
            });
            return {
              ...event,
              updatesCount
            };
          } catch (_err) {
            return {
              ...event,
              updatesCount: 0
            };
          }
        })
      );

      const pages = Math.ceil(total / limit);

      res.json({
        data: eventsWithUpdates,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get all updates with pagination
  async getAllUpdates(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req.query.tenantId as string) || req.headers['x-tenant-id'] as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      if (!tenantId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
        return;
      }

      // Build filter
      const filter: any = { tenantId };
      
      // Optional filters
      if (req.query.userId) {
        filter.userId = req.query.userId;
      }
      if (req.query.dialogId) {
        filter.dialogId = req.query.dialogId;
      }
      if (req.query.entityId) {
        filter.entityId = req.query.entityId;
      }
      if (req.query.eventType) {
        filter.eventType = req.query.eventType;
      }
      if (req.query.eventId) {
        // eventId теперь всегда строка (evt_...) в Update документах
        filter.eventId = req.query.eventId;
      }
      if (req.query.published !== undefined) {
        filter.published = req.query.published === 'true';
      }

      // Get total count
      const total = await Update.countDocuments(filter);

      // Формируем сортировку
      let sortOptions: Record<string, 1 | -1> = { createdAt: -1 }; // По умолчанию
      if (req.query.sort) {
        const sortParam = String(req.query.sort);
        // Формат: (field,direction)
        const match = sortParam.match(/\(([^,]+),([^)]+)\)/);
        if (match) {
          const field = match[1].trim();
          const direction = match[2].trim().toLowerCase();
          sortOptions = {};
          sortOptions[field] = direction === 'asc' ? 1 : -1;
        }
      }

      // Get updates with pagination
      const updates = await Update.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // eventId уже строка в Update документах, но преобразуем для совместимости
      const updatesWithStringEventId = updates.map(update => ({
        ...update,
        eventId: update.eventId ? String(update.eventId) : null
      }));

      const pages = Math.ceil(total / limit);

      res.json({
        data: updatesWithStringEventId,
        pagination: {
          page,
          limit,
          total,
          pages
        }
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};
