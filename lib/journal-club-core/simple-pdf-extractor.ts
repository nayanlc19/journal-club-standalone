/**
 * Simple PDF Text Extractor using pdf-parse
 * Faster alternative to Chandra for MVP
 */

import pdf from 'pdf-parse';
import fs from 'fs/promises';

export interface SimplePdfResult {
  success: boolean;
  markdown?: string;
  text?: string;
  num_pages?: number;
  error?: string;
}

/**
 * Extract text from PDF using pdf-parse (fast, simple)
 */
export async function extractPdfSimple(pdfPath: string): Promise<SimplePdfResult> {
  try {
    console.log(`[PDF Extractor] Reading PDF: ${pdfPath}`);
    const dataBuffer = await fs.readFile(pdfPath);
    
    const data = await pdf(dataBuffer);
    
    console.log(`[PDF Extractor] ✅ Extracted ${data.numpages} pages, ${data.text.length} characters`);
    
    return {
      success: true,
      markdown: data.text,
      text: data.text,
      num_pages: data.numpages,
    };
  } catch (error: any) {
    console.error(`[PDF Extractor] ❌ Failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
