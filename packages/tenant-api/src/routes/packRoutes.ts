import express from 'express';
import { packController } from '../controllers/packController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validatePackId, validateDialogId } from '../validators/urlValidators/index.js';
import { validateBody, validateQuery } from '../validators/middleware.js';
import { createPackSchema, addDialogToPackSchema, packMessagesQuerySchema } from '../validators/schemas/index.js';

const router = express.Router();

router.get(
  '/',
  apiAuth,
  requirePermission('read'),
  packController.list
);

router.post(
  '/',
  apiAuth,
  requirePermission('write'),
  validateBody(createPackSchema),
  packController.create
);

router.post(
  '/:packId/dialogs',
  apiAuth,
  requirePermission('write'),
  validatePackId,
  validateBody(addDialogToPackSchema),
  packController.addDialog
);

router.delete(
  '/:packId/dialogs/:dialogId',
  apiAuth,
  requirePermission('write'),
  validatePackId,
  validateDialogId,
  packController.removeDialog
);

router.get(
  '/:packId/dialogs',
  apiAuth,
  requirePermission('read'),
  validatePackId,
  packController.getDialogs
);

router.get(
  '/:packId/messages',
  apiAuth,
  requirePermission('read'),
  validatePackId,
  validateQuery(packMessagesQuerySchema),
  packController.getMessages
);

router.get(
  '/:packId',
  apiAuth,
  requirePermission('read'),
  validatePackId,
  packController.getById
);

router.delete(
  '/:packId',
  apiAuth,
  requirePermission('delete'),
  validatePackId,
  packController.delete
);

export default router;
