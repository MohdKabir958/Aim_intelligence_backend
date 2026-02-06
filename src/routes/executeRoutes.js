import express from 'express';
import { executeCodeHandler } from '../controllers/codeExecutionController.js';

const router = express.Router();

// POST /api/execute - Execute code
router.post('/', executeCodeHandler);

export default router;
