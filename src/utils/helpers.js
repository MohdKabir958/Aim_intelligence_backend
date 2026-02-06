/**
 * Parse thinking blocks from GLM-4.7-Flash response
 * Model returns thinking in <think>...</think> tags
 */
export function parseThinkingBlock(text) {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/;
    const match = text.match(thinkRegex);

    if (match) {
        const thinking = match[1].trim();
        const content = text.replace(thinkRegex, '').trim();
        return { thinking, content };
    }

    return { thinking: null, content: text };
}

/**
 * Stream parser for real-time thinking extraction
 */
export class ThinkingStreamParser {
    constructor() {
        this.buffer = '';
        this.inThinking = false;
        this.thinkingBuffer = '';
        this.contentBuffer = '';
        this.thinkingStartTime = null;
    }

    /**
     * Process chunk of streamed text
     * Returns events: thinking_start, thinking_chunk, thinking_end, content_chunk
     */
    processChunk(chunk) {
        const events = [];
        this.buffer += chunk;

        // Check for thinking start
        if (!this.inThinking && this.buffer.includes('<think>')) {
            this.inThinking = true;
            this.thinkingStartTime = Date.now();
            events.push({ type: 'thinking_start' });

            // Extract content before <think>
            const beforeThink = this.buffer.split('<think>')[0];
            if (beforeThink) {
                events.push({ type: 'content_chunk', content: beforeThink });
            }

            this.buffer = this.buffer.split('<think>')[1] || '';
        }

        // Process thinking content
        if (this.inThinking) {
            if (this.buffer.includes('</think>')) {
                // Thinking block complete
                const thinkingContent = this.buffer.split('</think>')[0];
                this.thinkingBuffer += thinkingContent;

                const duration = (Date.now() - this.thinkingStartTime) / 1000;

                events.push({
                    type: 'thinking_chunk',
                    content: thinkingContent
                });

                events.push({
                    type: 'thinking_end',
                    thinking: this.thinkingBuffer,
                    duration
                });

                this.inThinking = false;
                this.buffer = this.buffer.split('</think>')[1] || '';

                // Process remaining content
                if (this.buffer) {
                    events.push({ type: 'content_chunk', content: this.buffer });
                    this.contentBuffer += this.buffer;
                    this.buffer = '';
                }
            } else {
                // Still in thinking block
                events.push({ type: 'thinking_chunk', content: this.buffer });
                this.thinkingBuffer += this.buffer;
                this.buffer = '';
            }
        } else {
            // Regular content
            if (this.buffer) {
                events.push({ type: 'content_chunk', content: this.buffer });
                this.contentBuffer += this.buffer;
                this.buffer = '';
            }
        }

        return events;
    }

    getResults() {
        return {
            thinking: this.thinkingBuffer || null,
            content: this.contentBuffer,
            thinkingDuration: this.thinkingStartTime
                ? (Date.now() - this.thinkingStartTime) / 1000
                : null
        };
    }
}

/**
 * Format date for display
 */
export function formatDate(date) {
    return new Date(date).toLocaleString();
}

/**
 * Generate conversation title from first message
 */
export function generateTitle(message) {
    const maxLength = 50;
    const cleaned = message.trim().replace(/\s+/g, ' ');

    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    return cleaned.substring(0, maxLength) + '...';
}
