import { executeCode } from '../services/codeExecutionService.js';

/**
 * POST /api/execute
 * Execute code in a sandboxed environment
 */
export async function executeCodeHandler(req, res, next) {
    try {
        const { language, code } = req.body;

        console.log(`📨 [Execute] Request: ${language}`);

        if (!language || !code) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: language and code'
            });
        }

        // Execute the code
        const result = await executeCode(language, code);

        res.json(result);

    } catch (error) {
        console.error('❌ [Execute] Error:', error);
        next(error);
    }
}

export default {
    executeCodeHandler
};
