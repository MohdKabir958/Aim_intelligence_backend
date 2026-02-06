import express from 'express';
import { getModels, getGPUStatus } from '../controllers/modelController.js';

const router = express.Router();

// GET /api/models - Get available models
router.get('/', getModels);

// GET /api/models/status - GPU health check
router.get('/status', getGPUStatus);

export default router;
