import express from 'express';
import { activityController } from '../controllers/activityController.js';

const router = express.Router();

router.get('/events-updates', activityController.getEventsUpdatesStats);
router.get('/api-requests', activityController.getApiRequestsStats);

export default router;
