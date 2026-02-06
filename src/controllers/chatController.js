import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getConversationById, addMessage, updateConversation } from '../database/db.js';
import { generateTitle } from '../utils/helpers.js';
import { streamChatCompletion } from '../services/ollamaService.js';
import { processDocument } from '../services/documentProcessor.js';

/**
 * Convert uploaded image files to base64 for Ollama vision API
 * @param {Array} attachments - Array of attachment objects with path, mimetype
 * @returns {Array} Array of base64 encoded images
 */
function processAttachmentsToBase64(attachments) {
    if (!attachments || attachments.length === 0) return [];

    const images = [];
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    for (const att of attachments) {
        // Only process image files
        if (!imageTypes.includes(att.mimetype)) {
            console.log(`⏭️ [Chat] Skipping non-image attachment: ${att.originalName}`);
            continue;
        }

        try {
            // Get the file path (attachments store relative path like /uploads/filename)
            // Support both 'path' and 'url' fields for backwards compatibility
            const relativePath = att.path || att.url;
            if (!relativePath) {
                console.warn(`⚠️ [Chat] Attachment missing path/url:`, att);
                continue;
            }
            const filePath = path.join(process.cwd(), relativePath);

            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ [Chat] File not found: ${filePath}`);
                continue;
            }

            // Read file and convert to base64
            const fileBuffer = fs.readFileSync(filePath);
            const base64 = fileBuffer.toString('base64');
            images.push(base64);

            console.log(`✅ [Chat] Processed image: ${att.originalName} (${Math.round(fileBuffer.length / 1024)}KB)`);
        } catch (error) {
            console.error(`❌ [Chat] Failed to process attachment: ${att.originalName}`, error.message);
        }
    }

    return images;
}

// Track active streams for cancellation
const activeStreams = new Map();

/**
 * POST /api/chat/stream
 * Stream chat response from Ollama on GPU
 */
export async function streamChat(req, res, next) {
    const streamId = uuidv4();
    let abortController = new AbortController();

    console.log('\n📨 [Chat] Incoming stream request');

    try {
        const { conversationId, message, model, options } = req.body;
        console.log(`   ConversationId: ${conversationId}`);
        console.log(`   Model: ${model || 'default'}`);
        console.log(`   Message: ${message?.substring(0, 50)}...`);

        if (!conversationId || !message) {
            console.log('❌ [Chat] Missing required fields');
            return res.status(400).json({ error: 'conversationId and message are required' });
        }

        // Verify conversation exists
        const conversation = await getConversationById(conversationId);
        if (!conversation) {
            console.log('❌ [Chat] Conversation not found');
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Save user message
        const userMessageId = uuidv4();
        await addMessage(conversationId, {
            id: userMessageId,
            role: 'user',
            content: message,
            attachments: req.body.attachments || []
        });
        console.log('✅ [Chat] User message saved');

        // Update conversation title and model if it's the first message
        if (conversation.messages.length === 0) {
            const generatedTitle = generateTitle(message);
            await updateConversation(conversationId, {
                title: generatedTitle,
                model: model || 'glm-4.7-flash'
            });
            console.log(`✅ [Chat] Title generated: ${generatedTitle}`);
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Track this stream for potential cancellation
        activeStreams.set(streamId, { abortController, conversationId });

        const assistantMessageId = uuidv4();
        res.write(`data: ${JSON.stringify({ type: 'start', messageId: assistantMessageId, streamId })}\n\n`);

        // Process attachments for BOTH OCR/Text Extraction AND Vision (base64)
        const attachments = req.body.attachments || [];
        const attachmentImages = processAttachmentsToBase64(attachments);

        // Extract text from documents (PDF, OCR, etc.)
        let extractedTexts = [];
        if (attachments.length > 0) {
            console.log(`📑 [Chat] Extracting text from ${attachments.length} attachments...`);
            for (const att of attachments) {
                const processed = await processDocument(att);
                if (processed && processed.content) {
                    extractedTexts.push(`--- FILE: ${processed.filename} ---\n${processed.content}`);
                }
            }
        }

        // Combine user message with extracted text
        let combinedMessage = message;
        if (extractedTexts.length > 0) {
            combinedMessage = `${message}\n\n---\n📎 Attached Document Content:\n\n${extractedTexts.join('\n\n')}`;
            console.log(`✅ [Chat] Message combined with ${extractedTexts.length} documents. Total length: ${combinedMessage.length} chars`);
        }

        console.log(`🖼️ [Chat] Processed ${attachmentImages.length} images for vision`);

        // Build message history for context
        const messageHistory = [
            // Include system prompt if configured
            ...(options?.systemPrompt ? [{
                role: 'system',
                content: options.systemPrompt
            }] : []),
            // Include previous messages for context
            ...conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            // Current user message with combined text and vision images
            {
                role: 'user',
                content: combinedMessage,
                ...(attachmentImages.length > 0 ? { images: attachmentImages } : {})
            }
        ];

        console.log(`🔄 [Chat] Sending ${messageHistory.length} messages to Ollama...`);

        let fullContent = '';
        let fullThinking = '';
        let thinkingStarted = false;
        let thinkingEnded = false;

        try {
            const result = await streamChatCompletion(
                {
                    model: model || conversation.model || 'glm-4.7-flash',
                    messages: messageHistory,
                    options: {
                        temperature: options?.temperature ?? 0.7,
                        topP: options?.topP ?? 1,
                        maxTokens: options?.maxTokens ?? 4096
                    }
                },
                // Chunk callback
                (chunk) => {
                    if (chunk.type === 'thinking_chunk') {
                        if (!thinkingStarted) {
                            thinkingStarted = true;
                            console.log('💭 [Chat] Thinking started...');
                            res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);
                        }
                        fullThinking += chunk.content;
                        res.write(`data: ${JSON.stringify({ type: 'thinking_chunk', content: chunk.content })}\n\n`);
                    } else if (chunk.type === 'content_chunk') {
                        if (thinkingStarted && !thinkingEnded) {
                            thinkingEnded = true;
                            console.log('💬 [Chat] Content started...');
                            res.write(`data: ${JSON.stringify({
                                type: 'thinking_end',
                                thinking: fullThinking,
                                duration: 0
                            })}\n\n`);
                        }
                        if (!thinkingStarted && !thinkingEnded) {
                            // First content chunk without thinking
                            thinkingEnded = true;
                        }
                        fullContent += chunk.content;
                        res.write(`data: ${JSON.stringify({ type: 'content_chunk', content: chunk.content })}\n\n`);
                    }
                },
                abortController.signal
            );

            // End thinking if it was started but no content came after
            if (thinkingStarted && !thinkingEnded) {
                res.write(`data: ${JSON.stringify({
                    type: 'thinking_end',
                    thinking: fullThinking,
                    duration: result.thinkingDuration || 0
                })}\n\n`);
            }

            // Send completion signal with stats
            res.write(`data: ${JSON.stringify({
                type: 'done',
                stats: result.stats
            })}\n\n`);

            console.log(`✅ [Chat] Stream complete. Generated ${result.content.length} chars`);

            // Save assistant message to database
            await addMessage(conversationId, {
                id: assistantMessageId,
                role: 'assistant',
                content: result.content,
                thinking: result.thinking || null,
                thinking_duration: result.thinkingDuration || null
            });
            console.log('✅ [Chat] Assistant message saved');

        } catch (streamError) {
            console.error('❌ [Chat] Stream error:', streamError.message);
            if (streamError.message === 'Generation cancelled') {
                res.write(`data: ${JSON.stringify({ type: 'cancelled' })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    message: streamError.message || 'Failed to generate response'
                })}\n\n`);
            }
        }

        // Clean up
        activeStreams.delete(streamId);
        res.end();

    } catch (error) {
        console.error('❌ [Chat] Fatal error:', error);
        activeStreams.delete(streamId);

        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    }
}

/**
 * POST /api/chat/stop
 * Stop current generation
 */
export async function stopGeneration(req, res, next) {
    try {
        const { streamId } = req.body;
        console.log(`🛑 [Chat] Stop request for streamId: ${streamId}`);

        if (streamId && activeStreams.has(streamId)) {
            const stream = activeStreams.get(streamId);
            stream.abortController.abort();
            activeStreams.delete(streamId);
            res.json({ success: true, message: 'Generation stopped' });
        } else {
            // Try to abort all streams
            for (const [id, stream] of activeStreams) {
                stream.abortController.abort();
            }
            activeStreams.clear();
            res.json({ success: true, message: 'All generations stopped' });
        }
    } catch (error) {
        next(error);
    }
}
