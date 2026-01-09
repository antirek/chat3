import express from 'express';
import {
  getModels,
  getModelData,
  getModelItem,
  createModelItem,
  updateModelItem,
  deleteModelItem
} from '../controllers/dbExplorerController.js';

const router = express.Router();

/**
 * @swagger
 * /api/db-explorer/models:
 *   get:
 *     summary: Get list of available models
 *     tags: [DB Explorer]
 *     responses:
 *       200:
 *         description: List of models
 */
router.get('/models', getModels);

/**
 * @swagger
 * /api/db-explorer/models/{modelName}:
 *   get:
 *     summary: Get model data with pagination
 *     tags: [DB Explorer]
 *     parameters:
 *       - in: path
 *         name: modelName
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortDirection
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Model data
 */
router.get('/models/:modelName', getModelData);

/**
 * @swagger
 * /api/db-explorer/models/{modelName}/{id}:
 *   get:
 *     summary: Get single model item by ID
 *     tags: [DB Explorer]
 *     parameters:
 *       - in: path
 *         name: modelName
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Model item
 */
router.get('/models/:modelName/:id', getModelItem);

/**
 * @swagger
 * /api/db-explorer/models/{modelName}:
 *   post:
 *     summary: Create new model item
 *     tags: [DB Explorer]
 *     parameters:
 *       - in: path
 *         name: modelName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Item created
 */
router.post('/models/:modelName', createModelItem);

/**
 * @swagger
 * /api/db-explorer/models/{modelName}/{id}:
 *   put:
 *     summary: Update model item
 *     tags: [DB Explorer]
 *     parameters:
 *       - in: path
 *         name: modelName
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Item updated
 */
router.put('/models/:modelName/:id', updateModelItem);

/**
 * @swagger
 * /api/db-explorer/models/{modelName}/{id}:
 *   delete:
 *     summary: Delete model item
 *     tags: [DB Explorer]
 *     parameters:
 *       - in: path
 *         name: modelName
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item deleted
 */
router.delete('/models/:modelName/:id', deleteModelItem);

export default router;

