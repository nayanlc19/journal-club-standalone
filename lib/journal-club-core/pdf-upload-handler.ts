/**
 * PDF Upload Handler with Preview and Confirmation
 * Allows users to manually upload PDFs when automatic fetching fails
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline/promises';

const execFileAsync = promisify(execFile);

interface PdfUploadResult {
  success: boolean;
  pdfPath?: string;
  pdfBuffer?: Buffer;
  metadata?: {
    title?: string;
    author?: string;
    pages?: number;
    fileSize?: string;
  };
  error?: string;
}

/**
 * Generate PDF thumbnail (first page as PNG)
 */
async function generatePdfThumbnail(pdfPath: string, outputPath: string): Promise<boolean> {
  try {
    const scriptPath = path.join(import.meta.dirname, 'pdf-thumbnail-generator.py');

    await execFileAsync('python', [scriptPath, pdfPath, outputPath], {
      timeout: 30000
    });

    // Check if thumbnail was created
    await fs.access(outputPath);
    return true;
  } catch (error) {
    console.error('[PDF Upload] Failed to generate thumbnail:', error);
    return false;
  }
}

/**
 * Extract PDF metadata
 */
async function extractPdfMetadata(pdfPath: string): Promise<any> {
  try {
    const scriptPath = path.join(import.meta.dirname, 'pdf-metadata-extractor.py');

    const { stdout } = await execFileAsync('python', [scriptPath, pdfPath], {
      timeout: 10000
    });

    return JSON.parse(stdout);
  } catch (error) {
    console.error('[PDF Upload] Failed to extract metadata:', error);
    return {};
  }
}

/**
 * Format file size to human readable
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Interactive PDF upload with preview and confirmation
 */
export async function handleManualPdfUpload(doi: string, outputDir: string): Promise<PdfUploadResult> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           📄 Manual PDF Upload Required                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`❌ Could not automatically fetch PDF for DOI: ${doi}`);
  console.log('\n💡 You can manually upload the PDF file:\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let confirmed = false;
  let finalPdfPath: string | undefined;
  let finalPdfBuffer: Buffer | undefined;

  while (!confirmed) {
    try {
      // Ask for PDF file path
      const pdfPath = await rl.question('📁 Enter the full path to the PDF file (or "skip" to abort): ');

      if (pdfPath.toLowerCase() === 'skip') {
        rl.close();
        return {
          success: false,
          error: 'User skipped manual upload'
        };
      }

      // Validate file exists
      let stats;
      try {
        stats = await fs.stat(pdfPath);
      } catch (error) {
        console.log('\n❌ Error: File not found or inaccessible');
        console.log('   Please check the path and try again.\n');
        continue;
      }

      // Validate it's a PDF
      if (!pdfPath.toLowerCase().endsWith('.pdf')) {
        console.log('\n❌ Error: File must be a PDF (.pdf extension)');
        console.log('   Please provide a PDF file.\n');
        continue;
      }

      // Read PDF buffer
      const pdfBuffer = await fs.readFile(pdfPath);

      // Validate PDF content
      if (!pdfBuffer.toString('utf-8', 0, 4).includes('%PDF')) {
        console.log('\n❌ Error: File does not appear to be a valid PDF');
        console.log('   The file header is missing PDF signature.\n');
        continue;
      }

      console.log('\n✅ PDF file loaded successfully!');
      console.log(`   File size: ${formatFileSize(stats.size)}`);

      // Extract metadata
      console.log('\n🔍 Extracting PDF information...');
      const metadata = await extractPdfMetadata(pdfPath);

      if (metadata.title) {
        console.log(`\n📋 PDF Metadata:`);
        console.log(`   Title: ${metadata.title || 'Unknown'}`);
        console.log(`   Author: ${metadata.author || 'Unknown'}`);
        console.log(`   Pages: ${metadata.pages || 'Unknown'}`);
      }

      // Generate thumbnail
      console.log('\n🖼️  Generating preview...');
      const thumbnailPath = path.join(outputDir, 'pdf_preview.png');
      const thumbnailGenerated = await generatePdfThumbnail(pdfPath, thumbnailPath);

      if (thumbnailGenerated) {
        console.log(`✅ Preview saved to: ${thumbnailPath}`);
        console.log('   Please open this image to verify it\'s the correct paper.\n');
      } else {
        console.log('⚠️  Could not generate preview (continuing anyway)\n');
      }

      // Ask for confirmation
      const confirm = await rl.question('✅ Is this the correct PDF? (yes/no/retry): ');

      if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
        finalPdfPath = pdfPath;
        finalPdfBuffer = pdfBuffer;
        confirmed = true;
        console.log('\n✅ PDF confirmed! Proceeding with analysis...\n');
      } else if (confirm.toLowerCase() === 'retry' || confirm.toLowerCase() === 'r') {
        console.log('\n🔄 Please upload a different PDF file.\n');
        continue;
      } else {
        console.log('\n🔄 Please try uploading the PDF again.\n');
        continue;
      }

    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      console.log('   Please try again.\n');
    }
  }

  rl.close();

  return {
    success: true,
    pdfPath: finalPdfPath,
    pdfBuffer: finalPdfBuffer,
    metadata: await extractPdfMetadata(finalPdfPath!)
  };
}
