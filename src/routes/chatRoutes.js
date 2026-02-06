import express from 'express';
import { streamChat, stopGeneration } from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat/stream - Stream chat response
router.post('/stream', streamChat);

// POST /api/chat/stop - Stop current generation
router.post('/stop', stopGeneration);

export default router;
