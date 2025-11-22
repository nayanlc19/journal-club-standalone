/**
 * Full Automation Pipeline
 * Single function: DOI → Gamma Markdown + Educational Word Doc
 *
 * Optimized: Sends markdown directly to Gamma API (skips Word file generation)
 */

import { generateJournalClubAppraisal, generateJournalClubAppraisalFromUrl } from './orchestrator';
import { transformAppraisalToDocuments, documentDataToMarkdown } from './appraisal-to-document-transformer';
import { generateDocuments } from './document-generators/index';
import path from 'path';
import fs from 'fs/promises';

export interface FullPipelineResult {
  success: boolean;
  gammaMarkdown?: string; // Changed from gammaDocPath - direct markdown for Gamma API
  educationalDocPath?: string; // Educational Word file path
  error?: string;
  processingTime?: number;
  steps?: {
    pdfFetch: boolean;
    textExtraction: boolean;
    imageExtraction: boolean;
    criticalAppraisal: boolean;
    documentGeneration: boolean;
  };
}

export interface FullPipelineOptions {
  doi?: string;
  url?: string; // Publisher URL (alternative to DOI)
  outputDir?: string;
  onProgress?: (step: string, progress: number) => void;
}

/**
 * Full automation pipeline
 * Generates both Gamma Word doc and Educational PDF from a single DOI
 */
export async function generateFullDocuments(
  options: FullPipelineOptions
): Promise<FullPipelineResult> {
  const { doi, url, outputDir = './output', onProgress } = options;
  const startTime = Date.now();

  // Validate: must have either DOI or URL
  if (!doi && !url) {
    return {
      success: false,
      error: 'Either DOI or URL must be provided',
      processingTime: 0,
      steps: { pdfFetch: false, textExtraction: false, imageExtraction: false, criticalAppraisal: false, documentGeneration: false }
    };
  }

  const sourceLabel = doi ? `DOI: ${doi}` : `URL: ${url}`;

  const steps = {
    pdfFetch: false,
    textExtraction: false,
    imageExtraction: false,
    criticalAppraisal: false,
    documentGeneration: false,
  };

  try {
    console.log(`[Full Pipeline] Starting automation for ${sourceLabel}`);
    onProgress?.('Initializing', 0);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    //
    // STEP 1: Generate Critical Appraisal (includes PDF fetch, OCR, vision extraction)
    //
    onProgress?.('Generating critical appraisal', 10);

    const appraisalProgress = (progressObj: any) => {
      const message = progressObj.message || '';
      console.log(`[Full Pipeline] ${message}`);

      // Map appraisal progress to overall progress
      if (progressObj.stage === 'fetch') {
        steps.pdfFetch = true;
        onProgress?.('Fetching PDF', 15);
      } else if (progressObj.stage === 'ocr') {
        steps.textExtraction = true;
        onProgress?.('Extracting text', 25);
      } else if (message.toLowerCase().includes('vision')) {
        steps.imageExtraction = true;
        onProgress?.('Extracting images', 35);
      } else if (progressObj.stage === 'generation') {
        onProgress?.('Generating appraisal', 45);
      } else if (progressObj.stage === 'complete') {
        onProgress?.('Critical appraisal complete', 60);
      }
    };

    // Call appropriate orchestrator based on input type
    const appraisalResult = doi
      ? await generateJournalClubAppraisal(doi, appraisalProgress)
      : await generateJournalClubAppraisalFromUrl(url!, appraisalProgress);

    if (!appraisalResult.success || !appraisalResult.appraisal) {
      throw new Error(appraisalResult.error || 'Critical appraisal generation failed');
    }

    steps.criticalAppraisal = true;
    onProgress?.('Critical appraisal complete', 60);

    console.log(`[Full Pipeline] ✅ Critical appraisal generated (${appraisalResult.processingTime}ms)`);

    //
    // STEP 2: Transform appraisal to document format
    //
    onProgress?.('Transforming data for documents', 65);

    const { gammaData, educationalData } = transformAppraisalToDocuments(
      appraisalResult.appraisal,
      appraisalResult.visionImages
    );

    console.log(`[Full Pipeline] ✅ Data transformed for document generation`);

    //
    // STEP 3: Convert gammaData to markdown string (skip Word file generation)
    //
    onProgress?.('Converting to Gamma markdown', 70);

    const gammaMarkdown = documentDataToMarkdown(gammaData);
    const markdownLength = gammaMarkdown.length;
    const markdownChars = markdownLength.toLocaleString();

    console.log(`[Full Pipeline] ✅ Gamma markdown generated (${markdownChars} characters)`);

    //
    // STEP 4: Generate Educational Word Document
    //
    onProgress?.('Creating educational Word document', 85);

    const educationalResult = await generateDocuments(educationalData, outputDir, gammaMarkdown);

    if (!educationalResult.success || !educationalResult.educationalDocPath) {
      throw new Error(educationalResult.error || 'Educational document generation failed');
    }

    steps.documentGeneration = true;
    console.log(`[Full Pipeline] ✅ Educational document created: ${educationalResult.educationalDocPath}`);

    //
    // DONE
    //
    const totalTime = Date.now() - startTime;
    onProgress?.('Complete!', 100);

    console.log(`[Full Pipeline] 🎉 Full automation complete in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`[Full Pipeline] 📝 Gamma Markdown: ${markdownChars} characters (ready for API)`);
    console.log(`[Full Pipeline] 📚 Educational Doc: ${educationalResult.educationalDocPath}`);

    return {
      success: true,
      gammaMarkdown,
      educationalDocPath: educationalResult.educationalDocPath,
      processingTime: totalTime,
      steps,
    };

  } catch (error: any) {
    console.error(`[Full Pipeline] ❌ Failed: ${error.message}`);

    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
      steps,
    };
  }
}
