import { Event } from '../models/index.js';
import * as eventUtils from '../utils/eventUtils.js';
import { parseFilters } from '../utils/queryParser.js';

export const eventController = {
  // Get all events with filtering and pagination
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const query = {
        tenantId: req.tenantId
      };

      // Apply filters
      if (req.query.eventType) {
        query.eventType = req.query.eventType;
      }

      if (req.query.entityType) {
        query.entityType = req.query.entityType;
      }

      if (req.query.entityId) {
        query.entityId = req.query.entityId;
      }

      if (req.query.actorId) {
        query.actorId = req.query.actorId;
      }

      if (req.query.actorType) {
        query.actorType = req.query.actorType;
      }

      // Date range filtering
      if (req.query.startDate || req.query.endDate) {
        query.createdAt = {};
        
        if (req.query.startDate) {
          query.createdAt.$gte = new Date(req.query.startDate);
        }
        
        if (req.query.endDate) {
          query.createdAt.$lte = new Date(req.query.endDate);
        }
      }

      // Sorting
      let sort = { createdAt: -1 }; // Default: newest first
      if (req.query.sort) {
        const sortMatch = req.query.sort.match(/\(([^,]+),([^)]+)\)/);
        if (sortMatch) {
          const field = sortMatch[1];
          const direction = sortMatch[2] === 'asc' ? 1 : -1;
          sort = { [field]: direction };
        }
      }

      const events = await Event.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Event.countDocuments(query);

      res.json({
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get event by ID
  async getById(req, res) {
    try {
      const event = await Event.findOne({
        _id: req.params.id,
        tenantId: req.tenantId
      }).lean();

      if (!event) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Event not found'
        });
      }

      res.json({
        data: event
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid event ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get events for a specific entity
  async getEntityEvents(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      const events = await eventUtils.getEntityEvents(
        req.tenantId,
        entityType,
        entityId,
        {
          limit,
          eventType: req.query.eventType || null
        }
      );

      res.json({
        data: events,
        count: events.length
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get events by type
  async getByType(req, res) {
    try {
      const { eventType } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const events = await eventUtils.getEventsByType(
        req.tenantId,
        eventType,
        {
          limit,
          skip,
          sort: { createdAt: -1 }
        }
      );

      const total = await Event.countDocuments({
        tenantId: req.tenantId,
        eventType
      });

      res.json({
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get events by actor (user who initiated the event)
  async getByActor(req, res) {
    try {
      const { actorId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const events = await eventUtils.getUserEvents(
        req.tenantId,
        actorId,
        {
          limit,
          skip,
          sort: { createdAt: -1 },
          eventType: req.query.eventType || null
        }
      );

      const total = await Event.countDocuments({
        tenantId: req.tenantId,
        actorId
      });

      res.json({
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Get event statistics
  async getStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const options = {};

      if (startDate) {
        options.startDate = new Date(startDate);
      }

      if (endDate) {
        options.endDate = new Date(endDate);
      }

      const stats = await eventUtils.getEventStats(req.tenantId, options);

      res.json({
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Delete old events (cleanup)
  async deleteOld(req, res) {
    try {
      const { beforeDate } = req.body;

      if (!beforeDate) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required field: beforeDate'
        });
      }

      const deletedCount = await eventUtils.deleteOldEvents(
        req.tenantId,
        new Date(beforeDate)
      );

      res.json({
        message: `Deleted ${deletedCount} old events`,
        deletedCount
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

export default eventController;

