import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { createWorker } from 'tesseract.js';

/**
 * Extract text from a PDF file
 * @param {string} filePath - Absolute path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        // Handle pdf-parse import differences (it might be the function itself or have a .default property)
        const parsePDF = typeof pdf === 'function' ? pdf : pdf.default;

        if (typeof parsePDF !== 'function') {
            throw new Error(`pdf-parse library is not loaded correctly. Type: ${typeof pdf}`);
        }

        const data = await parsePDF(dataBuffer);
        return data.text;
    } catch (error) {
        console.error(`❌ [Doc] PDF extraction failed for ${path.basename(filePath)}:`, error.message);
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}

/**
 * Extract text from an image using OCR (Tesseract.js)
 * @param {string} filePath - Absolute path to the image file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromImage(filePath) {
    const worker = await createWorker('eng');
    try {
        console.log(`🖼️ [Doc] Running OCR on: ${path.basename(filePath)}`);
        const { data: { text } } = await worker.recognize(filePath);
        await worker.terminate();
        return text;
    } catch (error) {
        console.error(`❌ [Doc] OCR failed for ${path.basename(filePath)}:`, error.message);
        await worker.terminate();
        throw new Error(`Failed to extract text from image (OCR): ${error.message}`);
    }
}

/**
 * Extract text from a plain text file
 * @param {string} filePath - Absolute path to the text file
 * @returns {Promise<string>} - File content
 */
async function extractTextFromTextFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`❌ [Doc] Text read failed for ${path.basename(filePath)}:`, error.message);
        throw new Error(`Failed to read text file: ${error.message}`);
    }
}

/**
 * Main entry point for processing attachments
 * @param {Object} attachment - The attachment object containing path and mimetype
 * @returns {Promise<Object>} - Object with filename and extracted content
 */
export async function processDocument(attachment) {
    const relativePath = attachment.path || attachment.url;
    if (!relativePath) {
        console.error(`❌ [Doc] Missing path/url for attachment:`, attachment);
        return { filename: 'unknown', content: 'Error: Missing file path', error: true };
    }
    const filePath = path.join(process.cwd(), relativePath);
    const mimeType = attachment.mimetype;
    const filename = attachment.originalName || path.basename(filePath);

    console.log(`📄 [Doc] Processing: ${filename} (${mimeType})`);

    let content = '';

    try {
        if (mimeType === 'application/pdf') {
            content = await extractTextFromPDF(filePath);
        } else if (mimeType.startsWith('image/')) {
            content = await extractTextFromImage(filePath);
        } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            content = await extractTextFromTextFile(filePath);
        } else {
            console.warn(`⚠️ [Doc] Unsupported file type for text extraction: ${mimeType}`);
            return null;
        }

        return {
            filename,
            content: content.trim()
        };
    } catch (error) {
        console.error(`❌ [Doc] Processing failed for ${filename}:`, error.message);
        return {
            filename,
            content: `Error extracting text: ${error.message}`,
            error: true
        };
    }
}

export default {
    processDocument
};
