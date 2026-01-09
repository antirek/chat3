import { Dialog, Message, Event, Update } from '@chat3/models';

export const eventsController = {
  // Get events for a dialog
  async getDialogEvents(req, res) {
    try {
      const { dialogId } = req.params;
      const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
      const limit = parseInt(req.query.limit) || 100;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
      }

      // Проверяем, существует ли диалог
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId
      }).lean();

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Dialog with ID ${dialogId} not found`
        });
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
          // eslint-disable-next-line no-unused-vars
          } catch (err) {
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
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get updates for a dialog
  async getDialogUpdates(req, res) {
    try {
      const { dialogId } = req.params;
      const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
      const limit = parseInt(req.query.limit) || 100;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
      }

      // Проверяем, существует ли диалог
      const dialog = await Dialog.findOne({
        dialogId,
        tenantId
      }).lean();

      if (!dialog) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Dialog with ID ${dialogId} not found`
        });
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
        let eventIdStr = null;
        if (update.eventId) {
          // Если eventId есть, преобразуем в строку
          if (typeof update.eventId === 'object' && update.eventId.toString) {
            eventIdStr = update.eventId.toString();
          } else {
            eventIdStr = String(update.eventId);
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
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get events for a message
  async getMessageEvents(req, res) {
    try {
      const { messageId } = req.params;
      const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
      const limit = parseInt(req.query.limit) || 100;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
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
          // eslint-disable-next-line no-unused-vars
          } catch (err) {
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
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get updates for a message
  async getMessageUpdates(req, res) {
    try {
      const { messageId } = req.params;
      const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
      const limit = parseInt(req.query.limit) || 100;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
      }

      // Проверяем, существует ли сообщение
      const message = await Message.findOne({
        messageId,
        tenantId
      }).lean();

      if (!message) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Message with ID ${messageId} not found`
        });
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
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get all events with pagination
  async getAllEvents(req, res) {
    try {
      const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
      }

      // Build filter
      const filter = { tenantId };
      
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

      // Get events with pagination
      const events = await Event.find(filter)
        .sort({ createdAt: -1 }) // Обратный хронологический порядок
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
          // eslint-disable-next-line no-unused-vars
          } catch (err) {
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
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get all updates with pagination
  async getAllUpdates(req, res) {
    try {
      const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tenantId is required (query parameter or X-Tenant-Id header)'
        });
      }

      // Build filter
      const filter = { tenantId };
      
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

      // Get updates with pagination
      const updates = await Update.find(filter)
        .sort({ createdAt: -1 }) // Обратный хронологический порядок
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
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

