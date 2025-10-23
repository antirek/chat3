import { Tenant } from '../models/index.js';

export const tenantController = {
  // Get all tenants (paginated)
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const tenants = await Tenant.find()
        .skip(skip)
        .limit(limit)
        .select('-__v');

      const total = await Tenant.countDocuments();

      res.json({
        data: tenants,
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

  // Get tenant by ID
  async getById(req, res) {
    try {
      const tenant = await Tenant.findById(req.params.id).select('-__v');

      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found'
        });
      }

      res.json({ data: tenant });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid tenant ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Create new tenant
  async create(req, res) {
    try {
      const tenant = await Tenant.create(req.body);

      res.status(201).json({
        data: tenant,
        message: 'Tenant created successfully'
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.errors
        });
      }
      if (error.code === 11000) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Tenant with this domain already exists'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Update tenant
  async update(req, res) {
    try {
      const tenant = await Tenant.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).select('-__v');

      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found'
        });
      }

      res.json({
        data: tenant,
        message: 'Tenant updated successfully'
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.errors
        });
      }
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid tenant ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Delete tenant
  async delete(req, res) {
    try {
      const tenant = await Tenant.findByIdAndDelete(req.params.id);

      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found'
        });
      }

      res.json({
        message: 'Tenant deleted successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid tenant ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

