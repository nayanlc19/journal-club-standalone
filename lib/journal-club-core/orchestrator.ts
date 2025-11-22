/**
 * Main Orchestrator for Journal Club Critical Appraisal
 * Coordinates PDF fetching, OCR extraction, and text generation
 */

import { fetchPdfForDoi, fetchFromUrl, extractArticleFromHtml } from './pdf-fetcher.js';
import { extractPdfWithMarkItDown } from './markitdown-ocr.js';
import { extractTablesAndFigures } from './vision-extractor.js';
import { extractWithPDFFigures2, convertPDFFigures2ToTableFigure } from './pdffigures2-extractor.js';
import { generateCriticalAppraisal, type PaperContent, type GeneratedAppraisal } from './text-generator.js';
import { handleManualPdfUpload } from './pdf-upload-handler.js';
import fs from 'fs/promises';
import path from 'path';

export interface ProcessingProgress {
  stage: string;
  progress: number; // 0-100
  message: string;
}

export interface JournalClubResult {
  success: boolean;
  appraisal?: GeneratedAppraisal;
  visionImages?: any[]; // TableFigure[] with actual images
  error?: string;
  processingTime?: number;
}

/**
 * Main pipeline: DOI → PDF → OCR → Text Generation
 */
export async function generateJournalClubAppraisal(
  doi: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<JournalClubResult> {
  const startTime = Date.now();
  console.log('\n🚀 SPEED OPTIMIZED PIPELINE 🚀');
  console.log('⚡ MarkItDown (Local): 2-3 seconds');
  console.log('⚡ Parallel text generation: 5-8 seconds');
  console.log('🎯 Target: < 25 seconds total\n');

  try {
    // Stage 1: Fetch PDF
    const fetchStartTime = Date.now();
    emitProgress(onProgress, {
      stage: 'fetch',
      progress: 10,
      message: 'Fetching PDF from academic sources...'
    });

    let pdfResult = await fetchPdfForDoi(doi);

    // If automatic fetch failed, offer manual upload
    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      console.log(`\n[Orchestrator] ❌ Automatic PDF fetch failed: ${pdfResult.error}`);

      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      const manualUpload = await handleManualPdfUpload(doi, tempDir);

      if (!manualUpload.success || !manualUpload.pdfBuffer) {
        return {
          success: false,
          error: `Failed to fetch PDF: ${pdfResult.error}. Manual upload: ${manualUpload.error}`
        };
      }

      // Use manually uploaded PDF
      pdfResult = {
        success: true,
        pdfBuffer: manualUpload.pdfBuffer,
        source: 'Manual Upload'
      };

      console.log('\n[Orchestrator] ✅ Using manually uploaded PDF');
    }

    const fetchDuration = ((Date.now() - fetchStartTime) / 1000).toFixed(2);
    emitProgress(onProgress, {
      stage: 'fetch',
      progress: 25,
      message: `PDF fetched from ${pdfResult.source} (${fetchDuration}s)`
    });

    // Save PDF temporarily
    if (!pdfResult.pdfBuffer) {
      return {
        success: false,
        error: 'PDF buffer is empty after fetch/upload'
      };
    }

    const tempPdfPath = path.join(process.cwd(), 'temp', `${doi.replace(/\//g, '_')}.pdf`);
    await fs.mkdir(path.dirname(tempPdfPath), { recursive: true });
    await fs.writeFile(tempPdfPath, pdfResult.pdfBuffer);

    // Stage 2: Extract with MarkItDown (LOCAL & FAST!)
    const ocrStartTime = Date.now();
    emitProgress(onProgress, {
      stage: 'ocr',
      progress: 30,
      message: '⚡ Extracting text with MarkItDown...'
    });

    const ocrResult = await extractPdfWithMarkItDown(tempPdfPath);

    if (!ocrResult.success || !ocrResult.markdown) {
      return {
        success: false,
        error: `Failed to extract PDF content: ${ocrResult.error}`
      };
    }
    
    const ocrDuration = ((Date.now() - ocrStartTime) / 1000).toFixed(2);
    emitProgress(onProgress, {
      stage: 'ocr',
      progress: 50,
      message: `✅ OCR complete in ${ocrDuration}s - ${ocrResult.text?.length} characters extracted`
    });

    // Stage 3: Generate Critical Appraisal
    const genStartTime = Date.now();
    emitProgress(onProgress, {
      stage: 'generation',
      progress: 55,
      message: '⚡ Generating appraisal + extracting tables/figures in PARALLEL...'
    });

    const paperContent: PaperContent = {
      markdown: ocrResult.markdown,
      text: ocrResult.text || ocrResult.markdown,
      doi,
    };

    // Run text generation and PDFFigures2 extraction in parallel
    // PDFFigures2 will extract actual images with high-quality detection
    const [appraisal, pdffigures2Result] = await Promise.all([
      generateCriticalAppraisal(paperContent),
      extractWithPDFFigures2(tempPdfPath), // PDFFigures2: Extract figures with advanced algorithms
    ]);

    let finalTablesFigures: any[] = [];

    if (pdffigures2Result.success && pdffigures2Result.figures && pdffigures2Result.figures.length > 0) {
      console.log(`[Orchestrator] ✅ PDFFigures2 extracted ${pdffigures2Result.figures.length} tables/figures with images`);
      // Convert to our standard format
      finalTablesFigures = pdffigures2Result.figures.map(fig => convertPDFFigures2ToTableFigure(fig));
    } else {
      // Fallback to Vision if PDFFigures2 fails
      console.log('[Orchestrator] ⚠️ PDFFigures2 failed, falling back to Vision');
      const visionResult = await extractTablesAndFigures(tempPdfPath);

      if (visionResult.success && visionResult.tablesFigures && visionResult.tablesFigures.length > 0) {
        console.log(`[Orchestrator] ✅ Vision found ${visionResult.tablesFigures.length} tables/figures (descriptions only)`);
        finalTablesFigures = visionResult.tablesFigures;
      }
    }

    // Format tables/figures for display in markdown
    if (finalTablesFigures.length > 0) {
      const formattedTables = finalTablesFigures
        .map((item, index) => {
          const imageMarkdown = item.imageBase64
            ? `![${item.title}](data:image/png;base64,${item.imageBase64})`
            : `[See original paper - Page ${item.pageNumber}]`;

          return `### ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} ${index + 1}: ${item.title}

**Page:** ${item.pageNumber}
**Importance Score:** ${item.relevanceScore}/10

**Explanation:**
${item.explanation}

${imageMarkdown}

---
`;
        })
        .join('\n\n');

      appraisal.tablesAndFigures = formattedTables;
    } else {
      console.log('[Orchestrator] ⚠️ No tables/figures extracted');
      appraisal.tablesAndFigures = '*No high-importance tables or figures were automatically detected in this paper.*';
    }

    const genDuration = ((Date.now() - genStartTime) / 1000).toFixed(2);
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    emitProgress(onProgress, {
      stage: 'complete',
      progress: 100,
      message: `🎉 Complete in ${totalDuration}s! (OCR: ${ocrDuration}s, Vision+Gen: ${genDuration}s)`
    });

    console.log('\n📊 PERFORMANCE SUMMARY 📊');
    console.log(`⏱️  Total Time: ${totalDuration}s`);
    console.log(`📄 PDF Fetch: ${fetchDuration}s`);
    console.log(`🔍 OCR (MarkItDown): ${ocrDuration}s`);
    console.log(`🔬 Vision + Text Gen (Parallel): ${genDuration}s`);
    console.log(`🎯 Target Met: ${parseFloat(totalDuration) <= 40 ? '✅ YES!' : '❌ No (target 40s)'}\n`);
    
    // Cleanup temp file
    await fs.unlink(tempPdfPath).catch(() => {});

    return {
      success: true,
      appraisal,
      visionImages: finalTablesFigures, // Include extracted figures for document generation
      processingTime: Date.now() - startTime
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
}

function emitProgress(
  callback: ((progress: ProcessingProgress) => void) | undefined,
  progress: ProcessingProgress
) {
  callback?.(progress);
  console.log(`[${progress.stage}] ${progress.progress}% - ${progress.message}`);
}

/**
 * URL-based pipeline: Publisher URL → PDF/HTML → OCR → Text Generation
 */
export async function generateJournalClubAppraisalFromUrl(
  url: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<JournalClubResult> {
  const startTime = Date.now();
  console.log('\n🚀 URL-BASED PIPELINE 🚀');
  console.log(`📎 Source: ${url}`);
  console.log('⚡ Supports PDF direct links and HTML article pages\n');

  try {
    // Stage 1: Fetch from URL
    const fetchStartTime = Date.now();
    emitProgress(onProgress, {
      stage: 'fetch',
      progress: 10,
      message: 'Fetching content from URL...'
    });

    const urlResult = await fetchFromUrl(url);

    if (!urlResult.success) {
      return {
        success: false,
        error: `Failed to fetch from URL: ${urlResult.error}`
      };
    }

    const fetchDuration = ((Date.now() - fetchStartTime) / 1000).toFixed(2);
    emitProgress(onProgress, {
      stage: 'fetch',
      progress: 25,
      message: `Content fetched from ${urlResult.source} (${fetchDuration}s)`
    });

    let ocrResult: { success: boolean; markdown?: string; text?: string; error?: string };
    let tempPdfPath: string | null = null;

    // Stage 2: Extract text
    const ocrStartTime = Date.now();

    if (urlResult.pdfBuffer) {
      // PDF path - use MarkItDown
      emitProgress(onProgress, {
        stage: 'ocr',
        progress: 30,
        message: '⚡ Extracting text with MarkItDown...'
      });

      // Save PDF temporarily
      const urlSafe = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      tempPdfPath = path.join(process.cwd(), 'temp', `${urlSafe}.pdf`);
      await fs.mkdir(path.dirname(tempPdfPath), { recursive: true });
      await fs.writeFile(tempPdfPath, urlResult.pdfBuffer);

      ocrResult = await extractPdfWithMarkItDown(tempPdfPath);

    } else if (urlResult.htmlContent) {
      // HTML path - extract article text
      emitProgress(onProgress, {
        stage: 'ocr',
        progress: 30,
        message: '⚡ Extracting article text from HTML...'
      });

      const articleText = extractArticleFromHtml(urlResult.htmlContent);

      if (articleText.length < 500) {
        return {
          success: false,
          error: 'Could not extract sufficient article content from HTML page'
        };
      }

      ocrResult = {
        success: true,
        markdown: articleText,
        text: articleText
      };

    } else {
      return {
        success: false,
        error: 'No content (PDF or HTML) retrieved from URL'
      };
    }

    if (!ocrResult.success || !ocrResult.markdown) {
      return {
        success: false,
        error: `Failed to extract content: ${ocrResult.error}`
      };
    }

    const ocrDuration = ((Date.now() - ocrStartTime) / 1000).toFixed(2);
    emitProgress(onProgress, {
      stage: 'ocr',
      progress: 50,
      message: `✅ Text extraction complete in ${ocrDuration}s - ${ocrResult.text?.length || ocrResult.markdown.length} characters`
    });

    // Stage 3: Generate Critical Appraisal
    const genStartTime = Date.now();
    emitProgress(onProgress, {
      stage: 'generation',
      progress: 55,
      message: '⚡ Generating critical appraisal...'
    });

    const paperContent: PaperContent = {
      markdown: ocrResult.markdown,
      text: ocrResult.text || ocrResult.markdown,
    };

    // Run generation (and PDF figures extraction if we have a PDF)
    let appraisal: GeneratedAppraisal;
    let finalTablesFigures: any[] = [];

    if (tempPdfPath) {
      // PDF path - can extract figures
      const [appraisalResult, pdffigures2Result] = await Promise.all([
        generateCriticalAppraisal(paperContent),
        extractWithPDFFigures2(tempPdfPath),
      ]);

      appraisal = appraisalResult;

      if (pdffigures2Result.success && pdffigures2Result.figures && pdffigures2Result.figures.length > 0) {
        console.log(`[Orchestrator] ✅ PDFFigures2 extracted ${pdffigures2Result.figures.length} tables/figures`);
        finalTablesFigures = pdffigures2Result.figures.map(fig => convertPDFFigures2ToTableFigure(fig));
      } else {
        // Fallback to Vision
        const visionResult = await extractTablesAndFigures(tempPdfPath);
        if (visionResult.success && visionResult.tablesFigures) {
          finalTablesFigures = visionResult.tablesFigures;
        }
      }
    } else {
      // HTML path - no figure extraction possible
      appraisal = await generateCriticalAppraisal(paperContent);
      console.log('[Orchestrator] ⚠️ HTML source - no figure extraction available');
    }

    // Format tables/figures
    if (finalTablesFigures.length > 0) {
      const formattedTables = finalTablesFigures
        .map((item, index) => {
          const imageMarkdown = item.imageBase64
            ? `![${item.title}](data:image/png;base64,${item.imageBase64})`
            : `[See original paper - Page ${item.pageNumber}]`;

          return `### ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} ${index + 1}: ${item.title}

**Page:** ${item.pageNumber}
**Importance Score:** ${item.relevanceScore}/10

**Explanation:**
${item.explanation}

${imageMarkdown}

---
`;
        })
        .join('\n\n');

      appraisal.tablesAndFigures = formattedTables;
    } else {
      appraisal.tablesAndFigures = '*No tables or figures were extracted from this source.*';
    }

    const genDuration = ((Date.now() - genStartTime) / 1000).toFixed(2);
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    emitProgress(onProgress, {
      stage: 'complete',
      progress: 100,
      message: `🎉 Complete in ${totalDuration}s!`
    });

    console.log('\n📊 PERFORMANCE SUMMARY 📊');
    console.log(`⏱️  Total Time: ${totalDuration}s`);
    console.log(`📄 URL Fetch: ${fetchDuration}s`);
    console.log(`🔍 Text Extraction: ${ocrDuration}s`);
    console.log(`🔬 Generation: ${genDuration}s\n`);

    // Cleanup temp file
    if (tempPdfPath) {
      await fs.unlink(tempPdfPath).catch(() => {});
    }

    return {
      success: true,
      appraisal,
      visionImages: finalTablesFigures,
      processingTime: Date.now() - startTime
    };

  } catch (error: any) {
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
}
