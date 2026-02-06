import axios from 'axios';

/**
 * Ollama API Service
 * Connects to Ollama running on cloud GPU
 */

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://45.198.59.91:11434';

/**
 * Get available models from Ollama
 * @returns {Promise<Array>} List of available models
 */
export async function getModels() {
    const url = `${OLLAMA_BASE_URL}/api/tags`;
    console.log(`\n🔍 [Ollama] Fetching models from: ${url}`);

    try {
        const response = await axios.get(url, {
            timeout: 10000
        });

        console.log(`✅ [Ollama] Response status: ${response.status}`);
        console.log(`📦 [Ollama] Models found: ${response.data?.models?.length || 0}`);

        if (response.data && response.data.models) {
            return response.data.models.map(model => ({
                name: model.name,
                displayName: model.name.split(':')[0],
                size: model.size,
                modifiedAt: model.modified_at,
                details: model.details || {}
            }));
        }
        return [];
    } catch (error) {
        console.error(`\n❌ [Ollama] Connection failed to: ${url}`);
        console.error(`   Error type: ${error.code || error.name}`);
        console.error(`   Message: ${error.message}`);
        if (error.response) {
            console.error(`   Response status: ${error.response.status}`);
            console.error(`   Response data: ${JSON.stringify(error.response.data)}`);
        }
        if (error.cause) {
            console.error(`   Cause: ${error.cause.message}`);
        }
        throw new Error(`Ollama connection failed: ${error.message}`);
    }
}

/**
 * Check if Ollama server is reachable
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
    try {
        const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
            timeout: 5000
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

/**
 * Normalize model name to ensure it has a tag (default to :latest)
 */
function normalizeModelName(modelName) {
    if (!modelName) return 'glm-4.7-flash:latest';
    if (!modelName.includes(':')) {
        return `${modelName}:latest`;
    }
    return modelName;
}

/**
 * Generate chat completion with streaming
 * @param {Object} options - Chat options
 * @param {string} options.model - Model name
 * @param {Array} options.messages - Chat messages
 * @param {Object} options.options - Model options (temperature, etc.)
 * @param {Function} onChunk - Callback for each chunk
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object>} Final response with stats
 */
export async function streamChatCompletion({ model, messages, options = {} }, onChunk, signal) {
    const url = `${OLLAMA_BASE_URL}/api/chat`;
    const normalizedModel = normalizeModelName(model);

    console.log(`🤖 [Ollama] Starting stream for model: ${normalizedModel}`);

    const requestBody = {
        model: normalizedModel,
        messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.images ? { images: msg.images } : {})
        })),
        stream: true,
        options: {
            temperature: options.temperature ?? 0.7,
            top_p: options.topP ?? 1,
            num_predict: options.maxTokens ?? 4096
        }
    };

    let fullContent = '';
    let thinkingContent = '';
    let stats = {};

    try {
        const response = await axios({
            method: 'POST',
            url,
            data: requestBody,
            responseType: 'stream',
            timeout: 300000, // 5 minute timeout for long generations
            signal
        });

        return new Promise((resolve, reject) => {
            let buffer = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();

                // Process complete JSON objects (newline-delimited)
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const data = JSON.parse(line);

                        if (data.error) {
                            console.error('❌ [Ollama] Error in chunk:', data.error);
                            reject(new Error(data.error));
                            return;
                        }

                        if (data.message) {
                            const content = data.message.content || '';
                            const thinking = data.message.thinking || '';

                            if (thinking) {
                                thinkingContent += thinking;
                                onChunk({ type: 'thinking_chunk', content: thinking });
                            }

                            if (content) {
                                fullContent += content;
                                onChunk({ type: 'content_chunk', content });
                            }
                        }

                        if (data.done) {
                            stats = {
                                totalDuration: data.total_duration,
                                loadDuration: data.load_duration,
                                promptEvalCount: data.prompt_eval_count,
                                promptEvalDuration: data.prompt_eval_duration,
                                evalCount: data.eval_count,
                                evalDuration: data.eval_duration
                            };
                        }
                    } catch (e) {
                        console.error('Failed to parse Ollama chunk:', e.message);
                    }
                }
            });

            response.data.on('end', () => {
                resolve({
                    content: fullContent,
                    thinking: thinkingContent,
                    thinkingDuration: stats.promptEvalDuration ? stats.promptEvalDuration / 1e9 : 0,
                    stats
                });
            });

            response.data.on('error', (error) => {
                reject(error);
            });
        });
    } catch (error) {
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
            throw new Error('Generation cancelled');
        }
        throw error;
    }
}

/**
 * Generate a single completion (non-streaming)
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated response
 */
export async function generateCompletion({ model, prompt, options = {} }) {
    const url = `${OLLAMA_BASE_URL}/api/generate`;
    const normalizedModel = normalizeModelName(model);

    const requestBody = {
        model: normalizedModel,
        prompt,
        stream: false,
        options: {
            temperature: options.temperature ?? 0.7,
            top_p: options.topP ?? 1,
            num_predict: options.maxTokens ?? 4096
        }
    };

    try {
        const response = await axios.post(url, requestBody, {
            timeout: 300000
        });

        return {
            response: response.data.response,
            context: response.data.context,
            stats: {
                totalDuration: response.data.total_duration,
                evalCount: response.data.eval_count
            }
        };
    } catch (error) {
        console.error('Ollama generate error:', error.message);
        throw error;
    }
}

export default {
    getModels,
    checkHealth,
    streamChatCompletion,
    generateCompletion,
    OLLAMA_BASE_URL
};
