import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Execute code in a sandboxed environment with timeout
 * Supports: JavaScript (Node.js), Python
 */

const TIMEOUT_MS = 10000; // 10 seconds max execution
const MAX_OUTPUT_LENGTH = 10000; // 10KB output limit

// Ensure temp directory exists
const tempDir = path.join(process.cwd(), 'temp');
await fs.mkdir(tempDir, { recursive: true }).catch(() => { });

/**
 * Execute JavaScript code using Node.js
 */
async function executeJavaScript(code) {
    const tempFile = path.join(tempDir, `${uuidv4()}.js`);

    try {
        await fs.writeFile(tempFile, code);

        return new Promise((resolve, reject) => {
            const process = spawn('node', [tempFile], {
                timeout: TIMEOUT_MS,
                killSignal: 'SIGTERM'
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
                if (stdout.length > MAX_OUTPUT_LENGTH) {
                    process.kill();
                    reject(new Error('Output exceeded maximum length'));
                }
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                fs.unlink(tempFile).catch(() => { }); // Clean up

                if (code === 0) {
                    resolve({ success: true, output: stdout || '✓ Executed successfully' });
                } else {
                    resolve({ success: false, error: stderr || 'Execution failed' });
                }
            });

            process.on('error', (error) => {
                fs.unlink(tempFile).catch(() => { });
                reject(error);
            });
        });
    } catch (error) {
        await fs.unlink(tempFile).catch(() => { });
        throw error;
    }
}

/**
 * Execute Python code
 */
async function executePython(code) {
    const tempFile = path.join(tempDir, `${uuidv4()}.py`);

    try {
        await fs.writeFile(tempFile, code);

        return new Promise((resolve, reject) => {
            const process = spawn('python', [tempFile], {
                timeout: TIMEOUT_MS,
                killSignal: 'SIGTERM'
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
                if (stdout.length > MAX_OUTPUT_LENGTH) {
                    process.kill();
                    reject(new Error('Output exceeded maximum length'));
                }
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                fs.unlink(tempFile).catch(() => { }); // Clean up

                if (code === 0) {
                    resolve({ success: true, output: stdout || '✓ Executed successfully' });
                } else {
                    resolve({ success: false, error: stderr || 'Execution failed' });
                }
            });

            process.on('error', (error) => {
                fs.unlink(tempFile).catch(() => { });
                if (error.code === 'ENOENT') {
                    reject(new Error('Python is not installed or not in PATH'));
                } else {
                    reject(error);
                }
            });
        });
    } catch (error) {
        await fs.unlink(tempFile).catch(() => { });
        throw error;
    }
}

/**
 * Main execution function
 */
export async function executeCode(language, code) {
    console.log(`🔧 [CodeExec] Executing ${language} code...`);

    try {
        let result;

        switch (language.toLowerCase()) {
            case 'javascript':
            case 'js':
            case 'node':
                result = await executeJavaScript(code);
                break;

            case 'python':
            case 'py':
                result = await executePython(code);
                break;

            default:
                return {
                    success: false,
                    error: `Language "${language}" is not supported. Supported: JavaScript, Python`
                };
        }

        console.log(`✅ [CodeExec] Execution completed: ${result.success ? 'success' : 'error'}`);
        return result;

    } catch (error) {
        console.error(`❌ [CodeExec] Execution failed:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

export default {
    executeCode
};
