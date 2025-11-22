/**
 * Node.js wrapper for Chandra OCR Python script
 * Calls Python subprocess to extract PDF content
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ChandraResult {
  success: boolean;
  markdown?: string;
  text?: string;
  images?: string[];
  num_pages?: number;
  error?: string;
}

/**
 * Extract content from PDF using Chandra OCR
 */
export async function extractPdfWithChandra(
  pdfPath: string,
  includeImages: boolean = true
): Promise<ChandraResult> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'chandra-extractor.py');
    const args = [pythonScript, pdfPath];
    
    if (!includeImages) {
      args.push('--no-images');
    }
    
    console.log(`[Chandra] Extracting PDF: ${pdfPath}`);
    const startTime = Date.now();
    
    const python = spawn('python', args);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress from stderr
      if (stderr.includes('Processing')) {
        console.log(`[Chandra] ${stderr.trim()}`);
      }
    });
    
    python.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (code === 0) {
        try {
          const result: ChandraResult = JSON.parse(stdout);
          console.log(`[Chandra] ✅ Extraction complete in ${duration}s`);
          console.log(`[Chandra] Pages: ${result.num_pages}, Images: ${result.images?.length || 0}`);
          resolve(result);
        } catch (error) {
          console.error(`[Chandra] ❌ Failed to parse JSON output`);
          resolve({
            success: false,
            error: `Failed to parse output: ${error}`
          });
        }
      } else {
        console.error(`[Chandra] ❌ Process failed with code ${code}`);
        resolve({
          success: false,
          error: `Chandra process failed: ${stderr || 'Unknown error'}`
        });
      }
    });
    
    python.on('error', (error) => {
      console.error(`[Chandra] ❌ Failed to start: ${error.message}`);
      resolve({
        success: false,
        error: `Failed to start Python: ${error.message}`
      });
    });
  });
}
