import express from 'express';
import {
    getConversations,
    getConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    deleteMessage
} from '../controllers/conversationController.js';

const router = express.Router();

// GET /api/conversations - Get all conversations
router.get('/', getConversations);

// GET /api/conversations/:id - Get single conversation
router.get('/:id', getConversation);

// POST /api/conversations - Create new conversation
router.post('/', createConversation);

// PUT /api/conversations/:id - Update conversation
router.put('/:id', updateConversation);

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', deleteConversation);

// DELETE /api/conversations/:id/messages/:messageId - Delete message
router.delete('/:id/messages/:messageId', deleteMessage);

export default router;
