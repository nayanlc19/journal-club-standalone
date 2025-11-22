/**
 * MarkItDown OCR - Fast local PDF extraction using Microsoft's markitdown
 * Lightning fast, no API calls, works offline
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

export interface MarkItDownOcrResult {
  success: boolean;
  markdown?: string;
  text?: string;
  num_pages?: number;
  error?: string;
}

/**
 * Extract text from PDF using markitdown (Microsoft)
 * Fast local extraction - no API calls needed
 */
export async function extractPdfWithMarkItDown(pdfPath: string): Promise<MarkItDownOcrResult> {
  try {
    console.log(`[MarkItDown OCR] Starting extraction: ${pdfPath}`);
    const startTime = Date.now();

    // Call markitdown via Python (using execFile to prevent command injection)
    const { stdout, stderr } = await execFileAsync('python', ['-m', 'markitdown', pdfPath], {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large PDFs
      timeout: 30000, // 30 second timeout
    });
    
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    
    const markdown = stdout.trim();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`[MarkItDown OCR] ✅ Complete in ${duration}s - ${markdown.length} chars`);
    
    return {
      success: true,
      markdown,
      text: markdown,
    };
    
  } catch (error: any) {
    console.error(`[MarkItDown OCR] ❌ Failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
