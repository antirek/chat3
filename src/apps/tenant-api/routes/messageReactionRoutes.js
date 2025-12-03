// Этот файл больше не используется - маршруты реакций перенесены в userDialogRoutes.js
// 
// Новые маршруты:
// GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions
// POST /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions/{action}
//
// Старые deprecated маршруты удалены:
// - GET /api/messages/{messageId}/reactions
// - POST /api/messages/{messageId}/reactions/{action}

import express from 'express';
const router = express.Router();
export default router;

