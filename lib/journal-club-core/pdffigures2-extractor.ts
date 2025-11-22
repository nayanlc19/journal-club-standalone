/**
 * PDFFigures2 TypeScript Wrapper
 * Python implementation of PDFFigures2 algorithms
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PDFFigures2Figure {
  type: 'table' | 'figure';
  pageNumber: number;
  caption: string;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  };
  image: string; // Base64 encoded image
  confidence: number;
  source: 'pdffigures2';
}

export interface PDFFigures2Result {
  success: boolean;
  figures?: PDFFigures2Figure[];
  processing_time?: number;
  error?: string;
}

/**
 * Extract tables and figures from PDF using PDFFigures2 Python implementation
 * @param pdfPath Path to PDF file
 * @returns Promise with extraction results including cropped images
 */
export async function extractWithPDFFigures2(pdfPath: string): Promise<PDFFigures2Result> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'pdffigures2-python.py');

    console.log('[PDFFigures2-TS] Starting extraction...');
    console.log(`[PDFFigures2-TS] PDF: ${pdfPath}`);

    const pythonProcess = spawn('python', [scriptPath, pdfPath]);

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout;

    // Set timeout (2 minutes for PDFFigures2)
    const timeout = 120000;
    timeoutId = setTimeout(() => {
      pythonProcess.kill();
      resolve({
        success: false,
        error: 'PDFFigures2 extraction timeout after 2 minutes'
      });
    }, timeout);

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      stderr += message;
      // Log progress messages in real-time
      if (message.includes('[PDFFigures2]')) {
        console.log(message.trim());
      }
    });

    pythonProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error('[PDFFigures2-TS] Process error:', error);
      resolve({
        success: false,
        error: `Failed to start PDFFigures2 process: ${error.message}`
      });
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        console.error('[PDFFigures2-TS] Process exited with code:', code);
        console.error('[PDFFigures2-TS] stderr:', stderr);
        resolve({
          success: false,
          error: `PDFFigures2 process exited with code ${code}: ${stderr}`
        });
        return;
      }

      try {
        const result: PDFFigures2Result = JSON.parse(stdout);

        if (result.success && result.figures) {
          console.log(`[PDFFigures2-TS] Successfully extracted ${result.figures.length} items`);
          console.log(`[PDFFigures2-TS] Processing time: ${result.processing_time?.toFixed(2)}s`);

          // Log breakdown by type
          const tables = result.figures.filter(f => f.type === 'table').length;
          const figures = result.figures.filter(f => f.type === 'figure').length;
          console.log(`[PDFFigures2-TS] Breakdown: ${tables} tables, ${figures} figures`);
        } else {
          console.error('[PDFFigures2-TS] Extraction failed:', result.error);
        }

        resolve(result);
      } catch (error) {
        console.error('[PDFFigures2-TS] Failed to parse output:', error);
        console.error('[PDFFigures2-TS] stdout:', stdout);
        resolve({
          success: false,
          error: `Failed to parse PDFFigures2 output: ${error}`
        });
      }
    });
  });
}

/**
 * Convert PDFFigures2 figure to format compatible with the pipeline
 */
export function convertPDFFigures2ToTableFigure(fig: PDFFigures2Figure) {
  return {
    pageNumber: fig.pageNumber,
    type: fig.type,
    title: fig.caption || `${fig.type.charAt(0).toUpperCase() + fig.type.slice(1)} ${fig.pageNumber}`,
    explanation: `High-quality ${fig.type} extracted from page ${fig.pageNumber} (confidence: ${(fig.confidence * 100).toFixed(0)}%)`,
    imageBase64: fig.image ? fig.image.split(',')[1] : undefined,
    relevanceScore: Math.round(fig.confidence * 10), // Convert confidence to 0-10 scale
    source: 'pdffigures2'
  };
}