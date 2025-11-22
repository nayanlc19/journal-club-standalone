/**
 * PyMuPDF TypeScript Wrapper
 * Alternative to PDFFigures2 - no Java required, uses Python's PyMuPDF
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PyMuPDFFigure {
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
  image: string; // Base64 encoded image with data URI
  source: 'pymupdf' | 'pymupdf_drawing';
}

interface PyMuPDFResult {
  success: boolean;
  figures?: PyMuPDFFigure[];
  processing_time?: number;
  error?: string;
}

/**
 * Extract tables and figures from PDF using PyMuPDF
 * @param pdfPath Path to PDF file
 * @returns Promise with extraction results including cropped images
 */
export async function extractWithPyMuPDF(pdfPath: string): Promise<PyMuPDFResult> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'pymupdf-extractor.py');

    console.log('[PyMuPDF-TS] Starting extraction...');
    console.log(`[PyMuPDF-TS] PDF: ${pdfPath}`);

    const pythonProcess = spawn('python', [scriptPath, pdfPath]);

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout;

    // Set timeout (1 minute for PyMuPDF - it's fast)
    const timeout = 60000;
    timeoutId = setTimeout(() => {
      pythonProcess.kill();
      resolve({
        success: false,
        error: 'PyMuPDF extraction timeout after 1 minute'
      });
    }, timeout);

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      stderr += message;
      // Log progress messages in real-time
      if (message.includes('[PyMuPDF]')) {
        console.log(message.trim());
      }
    });

    pythonProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error('[PyMuPDF-TS] Process error:', error);
      resolve({
        success: false,
        error: `Failed to start PyMuPDF process: ${error.message}`
      });
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        console.error('[PyMuPDF-TS] Process exited with code:', code);
        console.error('[PyMuPDF-TS] stderr:', stderr);
        resolve({
          success: false,
          error: `PyMuPDF process exited with code ${code}: ${stderr}`
        });
        return;
      }

      try {
        const result: PyMuPDFResult = JSON.parse(stdout);

        if (result.success && result.figures) {
          console.log(`[PyMuPDF-TS] Successfully extracted ${result.figures.length} items`);
          console.log(`[PyMuPDF-TS] Processing time: ${result.processing_time?.toFixed(2)}s`);

          // Log breakdown by type
          const tables = result.figures.filter(f => f.type === 'table').length;
          const figures = result.figures.filter(f => f.type === 'figure').length;
          console.log(`[PyMuPDF-TS] Breakdown: ${tables} tables, ${figures} figures`);
        } else {
          console.error('[PyMuPDF-TS] Extraction failed:', result.error);
        }

        resolve(result);
      } catch (error) {
        console.error('[PyMuPDF-TS] Failed to parse output:', error);
        console.error('[PyMuPDF-TS] stdout:', stdout);
        resolve({
          success: false,
          error: `Failed to parse PyMuPDF output: ${error}`
        });
      }
    });
  });
}

/**
 * Convert PyMuPDF figure to format compatible with the pipeline
 */
export function convertPyMuPDFToTableFigure(fig: PyMuPDFFigure) {
  return {
    pageNumber: fig.pageNumber,
    type: fig.type,
    title: fig.caption,
    explanation: `Extracted ${fig.type} from page ${fig.pageNumber}`,
    imageBase64: fig.image ? fig.image.split(',')[1] : undefined,
    relevanceScore: 8, // Default score, can be enhanced with Vision later
    source: 'pymupdf'
  };
}