/**
 * Robust Pipeline Handler
 * Ensures the pipeline never fails regardless of publisher or paper format
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface RobustOptions {
  maxRetries?: number;
  fallbackStrategies?: boolean;
  verbose?: boolean;
}

export class RobustPipelineHandler {
  private maxRetries: number;
  private fallbackStrategies: boolean;
  private verbose: boolean;

  constructor(options: RobustOptions = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.fallbackStrategies = options.fallbackStrategies !== false;
    this.verbose = options.verbose || false;
  }

  /**
   * Wrap any async function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    context: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (this.verbose) {
          console.log(`[Robust] Attempt ${attempt}/${this.maxRetries} for ${context}`);
        }
        return await fn();
      } catch (error: any) {
        lastError = error;
        console.warn(`[Robust] Attempt ${attempt} failed for ${context}:`, error.message);

        if (attempt === this.maxRetries) {
          if (this.fallbackStrategies && fallback) {
            console.log(`[Robust] Using fallback strategy for ${context}`);
            try {
              return await fallback();
            } catch (fallbackError) {
              console.error(`[Robust] Fallback also failed for ${context}:`, fallbackError);
            }
          }
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Sanitize text to handle any publisher's special characters
   */
  async sanitizeText(text: string): Promise<string> {
    try {
      // Call Python universal sanitizer
      const result = await execAsync(`python -c "
import sys
sys.path.insert(0, '${path.join(__dirname).replace(/\\/g, '/')}')
from universal_text_sanitizer import sanitize_text
import json

text = '''${text.replace(/'/g, "\\'")}'''
print(json.dumps({'sanitized': sanitize_text(text)}))
"`);

      const parsed = JSON.parse(result.stdout);
      return parsed.sanitized;
    } catch (error) {
      // Fallback to basic sanitization
      return this.basicSanitize(text);
    }
  }

  /**
   * Basic text sanitization fallback
   */
  private basicSanitize(text: string): string {
    if (!text) return '';

    // Remove control characters
    text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Replace problematic Unicode spaces
    const spaceReplacements: { [key: string]: string } = {
      '\u202f': ' ',  // Narrow no-break space
      '\u200b': '',   // Zero-width space
      '\u00a0': ' ',  // Non-breaking space
      '\ufeff': '',   // Zero-width no-break space
      '\u2009': ' ',  // Thin space
      '\u200a': ' ',  // Hair space
    };

    for (const [char, replacement] of Object.entries(spaceReplacements)) {
      text = text.replace(new RegExp(char, 'g'), replacement);
    }

    return text;
  }

  /**
   * Handle PDF extraction with multiple fallback strategies
   */
  async extractPDF(pdfPath: string): Promise<any> {
    // Strategy 1: PDFFigures2 Python
    const pdffigures2 = async () => {
      const { extractWithPDFFigures2 } = await import('./pdffigures2-extractor.js');
      return await extractWithPDFFigures2(pdfPath);
    };

    // Strategy 2: Vision API
    const visionFallback = async () => {
      const { extractTablesAndFigures } = await import('./vision-extractor.js');
      return await extractTablesAndFigures(pdfPath);
    };

    // Strategy 3: Basic PyMuPDF extraction
    const pymupdfFallback = async () => {
      console.log('[Robust] Falling back to basic PyMuPDF extraction');
      const result = await execAsync(`python -c "
import fitz
import json
import base64

doc = fitz.open('${pdfPath.replace(/\\/g, '/')}')
figures = []

for page_num in range(len(doc)):
    page = doc[page_num]
    # Get all images
    image_list = page.get_images()
    for img_index, img in enumerate(image_list):
        try:
            xref = img[0]
            pix = fitz.Pixmap(doc, xref)
            if pix.n - pix.alpha < 4:  # GRAY or RGB
                img_data = pix.tobytes('png')
                figures.append({
                    'type': 'figure',
                    'pageNumber': page_num + 1,
                    'imageBase64': base64.b64encode(img_data).decode(),
                    'title': f'Figure {len(figures) + 1}'
                })
            pix = None
        except:
            pass

doc.close()
print(json.dumps({'success': True, 'figures': figures}))
"`);

      return JSON.parse(result.stdout);
    };

    // Try each strategy with retries
    return await this.withRetry(
      pdffigures2,
      'PDFFigures2 extraction',
      () => this.withRetry(visionFallback, 'Vision extraction', pymupdfFallback)
    );
  }

  /**
   * Safe document generation with fallback
   */
  async generateDocument(
    data: any,
    outputPath: string,
    type: 'gamma' | 'educational'
  ): Promise<boolean> {
    const generator = type === 'gamma' ? 'gamma_word_generator.py' : 'educational_word_generator_final.py';

    // Sanitize all text fields in data
    const sanitizeObject = async (obj: any): Promise<any> => {
      if (typeof obj === 'string') {
        return await this.sanitizeText(obj);
      }
      if (Array.isArray(obj)) {
        return Promise.all(obj.map(item => sanitizeObject(item)));
      }
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = await sanitizeObject(value);
        }
        return result;
      }
      return obj;
    };

    try {
      // Sanitize all data
      const sanitizedData = await sanitizeObject(data);

      // Write temp file
      const tempFile = path.join(path.dirname(outputPath), 'temp_sanitized.json');
      await fs.writeFile(tempFile, JSON.stringify(sanitizedData, null, 2));

      // Generate document
      const result = await execAsync(
        `python "${path.join(__dirname, 'document-generators', generator)}" "${tempFile}" "${outputPath}"`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      return true;
    } catch (error: any) {
      console.error(`[Robust] Document generation failed:`, error.message);

      // Fallback: Create minimal document
      if (this.fallbackStrategies) {
        console.log('[Robust] Creating minimal fallback document');
        return await this.createMinimalDocument(data, outputPath, type);
      }

      return false;
    }
  }

  /**
   * Create a minimal document as last resort
   */
  private async createMinimalDocument(
    data: any,
    outputPath: string,
    type: string
  ): Promise<boolean> {
    try {
      const pythonCode = `
from docx import Document
from docx.shared import Pt
import json
import sys

doc = Document()

# Title
title = doc.add_heading('Critical Appraisal', 0)

# Basic content
doc.add_paragraph('This document was generated with limited information due to processing errors.')
doc.add_paragraph('')
doc.add_paragraph('Title: ' + str(json.loads(open(sys.argv[1]).read()).get('title', 'Unknown')))
doc.add_paragraph('')
doc.add_heading('Content', 1)
doc.add_paragraph('Please refer to the original paper for complete information.')

# Save
doc.save(sys.argv[2])
print(json.dumps({'success': True}))
`;

      const tempScript = path.join(path.dirname(outputPath), 'temp_minimal.py');
      const tempData = path.join(path.dirname(outputPath), 'temp_minimal.json');

      await fs.writeFile(tempScript, pythonCode);
      await fs.writeFile(tempData, JSON.stringify(data));

      await execAsync(`python "${tempScript}" "${tempData}" "${outputPath}"`);

      // Cleanup
      await fs.unlink(tempScript).catch(() => {});
      await fs.unlink(tempData).catch(() => {});

      return true;
    } catch (error) {
      console.error('[Robust] Even minimal document creation failed:', error);
      return false;
    }
  }

  /**
   * Detect publisher and apply specific handling
   */
  async detectPublisher(text: string): Promise<string> {
    try {
      const result = await execAsync(`python -c "
import sys
sys.path.insert(0, '${path.join(__dirname).replace(/\\/g, '/')}')
from universal_text_sanitizer import detect_publisher
print(detect_publisher('''${text.replace(/'/g, "\\'")}'''))
"`);

      return result.stdout.trim();
    } catch {
      return 'unknown';
    }
  }
}

// Export singleton instance
export const robustHandler = new RobustPipelineHandler({
  maxRetries: 3,
  fallbackStrategies: true,
  verbose: false
});

// Export functions for direct use
export async function ensureRobustProcessing(fn: () => Promise<any>): Promise<any> {
  return robustHandler.withRetry(fn, 'main processing');
}

export async function sanitizeForDocument(text: string): Promise<string> {
  return robustHandler.sanitizeText(text);
}