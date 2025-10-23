import { User } from '../models/index.js';

export const userController = {
  // Get all users for current tenant (paginated)
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const query = { tenantId: req.tenantId };
      
      // Optional filters
      if (req.query.role) {
        query.role = req.query.role;
      }
      if (req.query.isActive !== undefined) {
        query.isActive = req.query.isActive === 'true';
      }

      const users = await User.find(query)
        .skip(skip)
        .limit(limit)
        .select('-password -__v')
        .populate('tenantId', 'name domain');

      const total = await User.countDocuments(query);

      res.json({
        data: users,
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

  // Get user by ID
  async getById(req, res) {
    try {
      const user = await User.findOne({
        _id: req.params.id,
        tenantId: req.tenantId
      })
        .select('-password -__v')
        .populate('tenantId', 'name domain');

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      res.json({ data: user });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid user ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Create new user
  async create(req, res) {
    try {
      const userData = {
        ...req.body,
        tenantId: req.tenantId
      };

      const user = await User.create(userData);
      
      // Remove password from response
      const userObject = user.toObject();
      delete userObject.password;

      res.status(201).json({
        data: userObject,
        message: 'User created successfully'
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
          message: 'User with this email already exists in this tenant'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Update user
  async update(req, res) {
    try {
      // Don't allow changing tenantId
      const updateData = { ...req.body };
      delete updateData.tenantId;
      updateData.updatedAt = new Date();

      const user = await User.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.tenantId },
        updateData,
        { new: true, runValidators: true }
      )
        .select('-password -__v')
        .populate('tenantId', 'name domain');

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      res.json({
        data: user,
        message: 'User updated successfully'
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
          message: 'Invalid user ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  },

  // Delete user
  async delete(req, res) {
    try {
      const user = await User.findOneAndDelete({
        _id: req.params.id,
        tenantId: req.tenantId
      });

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      res.json({
        message: 'User deleted successfully'
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid user ID'
        });
      }
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }
};

