import express from 'express';
import * as userController from '../controllers/userController.js';
import { apiAuth, requirePermission } from '../middleware/apiAuth.js';
import { validateUserId, validateDialogId } from '../validators/urlValidators/index.js';
import { validateQuery } from '../validators/middleware.js';
import { queryWithFilterSchema } from '../validators/schemas/index.js';

const router = express.Router();

router.get(
  '/:userId/packs',
  apiAuth,
  requirePermission('read'),
  validateUserId,
  validateQuery(queryWithFilterSchema),
  userController.getUserPacks
);

router.get(
  '/:userId/dialogs/:dialogId/packs',
  apiAuth,
  requirePermission('read'),
  validateUserId,
  validateDialogId,
  userController.getDialogPacks
);

export default router;
