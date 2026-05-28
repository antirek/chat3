import express from 'express';
import { activityController } from '../controllers/activityController.js';

const router = express.Router();

router.get('/events-updates', activityController.getEventsUpdatesStats);
router.get('/api-requests', activityController.getApiRequestsStats);
router.get('/dialogs-packs', activityController.getDialogsPacksStats);
router.get('/messages', activityController.getMessagesStats);

export default router;
