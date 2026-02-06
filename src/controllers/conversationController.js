import { v4 as uuidv4 } from 'uuid';
import * as db from '../database/db.js';

export async function getConversations(req, res, next) {
  try {
    const conversations = await db.getAllConversations();
    res.json(conversations);
  } catch (error) {
    next(error);
  }
}

export async function getConversation(req, res, next) {
  try {
    const conversation = await db.getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function createConversation(req, res, next) {
  try {
    const { title, model } = req.body;
    const id = uuidv4();
    const conversation = await db.createConversation(id, title, model);
    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function updateConversation(req, res, next) {
  try {
    const conversation = await db.updateConversation(req.params.id, req.body);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
}

export async function deleteConversation(req, res, next) {
  try {
    const success = await db.deleteConversation(req.params.id);
    if (!success) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const { id, messageId } = req.params;
    const success = await db.deleteMessageAndSubsequent(id, messageId);
    if (!success) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
}
