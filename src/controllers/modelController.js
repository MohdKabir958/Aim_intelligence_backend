import { getModels as fetchModels, checkHealth, OLLAMA_BASE_URL } from '../services/ollamaService.js';

/**
 * GET /api/models
 * Get available models from Ollama
 */
export async function getModels(req, res, next) {
    try {
        const models = await fetchModels();

        // Add some metadata for the frontend
        const enhancedModels = models.map(model => ({
            ...model,
            id: model.name,
            provider: 'ollama',
            isDefault: model.name.includes('glm-4.7-flash')
        }));

        res.json({
            models: enhancedModels,
            defaultModel: enhancedModels.find(m => m.isDefault)?.name || models[0]?.name || 'glm-4.7-flash',
            source: OLLAMA_BASE_URL
        });
    } catch (error) {
        console.error('Failed to fetch models:', error.message);

        // Return fallback model list if Ollama is unreachable
        res.json({
            models: [{
                id: 'glm-4.7-flash',
                name: 'glm-4.7-flash',
                displayName: 'GLM-4.7 Flash',
                provider: 'ollama',
                isDefault: true,
                offline: true
            }],
            defaultModel: 'glm-4.7-flash',
            source: OLLAMA_BASE_URL,
            error: error.message
        });
    }
}

/**
 * GET /api/models/status
 * Check GPU/Ollama server status
 */
export async function getGPUStatus(req, res, next) {
    try {
        const isHealthy = await checkHealth();

        res.json({
            status: isHealthy ? 'connected' : 'disconnected',
            url: OLLAMA_BASE_URL,
            provider: 'ollama',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'error',
            message: error.message,
            url: OLLAMA_BASE_URL,
            provider: 'ollama'
        });
    }
}
