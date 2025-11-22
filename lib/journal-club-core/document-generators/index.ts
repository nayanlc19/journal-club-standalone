/**
 * Document Generators
 * Creates dual output: Gamma-ready Word docs + Comprehensive educational PDFs
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TableFigure } from '../vision-extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

export interface DocumentSection {
  heading: string;
  content: string;
  explanations?: Record<string, string>; // Term -> Detailed explanation
  teaching_notes?: string[]; // Teaching points for educational PDF
  checklist_items?: ChecklistItem[];
  images?: ImageData[];
}

export interface ChecklistItem {
  item: string;
  rationale: string; // Why this checklist item matters
  assessment: string; // Present/Absent/Unclear/etc
}

export interface ImageData {
  title: string;
  base64: string;
  explanation: string;
}

export interface DocumentData {
  title: string;
  metadata?: {
    authors?: string;
    journal?: string;
    year?: string;
    doi?: string;
  };
  sections: DocumentSection[];
  fullMarkdown?: string;  // Raw markdown for Gamma
}

export interface GeneratorResult {
  success: boolean;
  gammaDocPath?: string;
  educationalDocPath?: string; // Changed from comprehensivePdfPath
  error?: string;
}

/**
 * Convert TableFigure[] to ImageData[]
 */
export function tableFiguresToImageData(tablesFigures: TableFigure[]): ImageData[] {
  return tablesFigures.map(tf => ({
    title: tf.title,
    base64: tf.imageBase64 || '',
    explanation: tf.explanation,
  }));
}

/**
 * Generate both Gamma Markdown and Educational Word doc
 * @param data - Educational document data (with all sections including Defense Q&A)
 * @param outputDir - Output directory path
 * @param gammaMarkdown - OPTIONAL: Separate gamma markdown (without Defense Q&A). If not provided, falls back to sections.
 */
export async function generateDocuments(
  data: DocumentData,
  outputDir: string,
  gammaMarkdown?: string
): Promise<GeneratorResult> {
  try {
    console.log('[Document Generators] Starting dual document generation...');

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Create temp JSON file for Python scripts
    const tempJsonPath = path.join(outputDir, 'temp_input.json');
    await fs.writeFile(tempJsonPath, JSON.stringify(data, null, 2), 'utf-8');

    // Output paths
    const safeTitle = data.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const gammaDocPath = path.join(outputDir, `${safeTitle}_Gamma.md`);  // Changed to .md for Gamma
    const educationalDocPath = path.join(outputDir, `${safeTitle}_Educational.docx`);

    // Generate Gamma Markdown file directly (not Word)
    console.log('[Document Generators] Creating Gamma-ready Markdown file...');

    // Use provided gammaMarkdown if available (CLEAN - no Defense Q&A)
    // Otherwise fall back to generating from sections (also clean)
    let markdownContent = gammaMarkdown;
    if (!markdownContent) {
      // Generate from sections - but EXCLUDE Defense Q&A and Research Glossary
      markdownContent = `# ${data.title}\n\n`;
      for (const section of data.sections) {
        // Skip educational-only sections from Gamma output
        if (section.heading.includes('Defense') || section.heading.includes('Glossary')) {
          continue;
        }
        markdownContent += `## ${section.heading}\n\n${section.content}\n\n`;
      }
    }

    await fs.writeFile(gammaDocPath, markdownContent, 'utf-8');
    console.log('[Document Generators] ✅ Gamma Markdown file created');

    // Generate Educational Word Document
    console.log('[Document Generators] Creating comprehensive educational Word document...');
    const eduScriptPath = path.join(__dirname, 'educational_word_generator.py');
    const eduResult = await execFileAsync('python', [
      eduScriptPath,
      tempJsonPath,
      educationalDocPath,
    ], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000,
    });

    const eduOutput = JSON.parse(eduResult.stdout.trim());
    if (!eduOutput.success) {
      throw new Error(`Educational document generation failed: ${eduOutput.error}`);
    }

    console.log('[Document Generators] ✅ Educational Word doc created');

    // Cleanup temp file
    await fs.unlink(tempJsonPath);

    console.log('[Document Generators] 🎉 Both documents generated successfully!');
    console.log(`  📄 Gamma Doc: ${gammaDocPath}`);
    console.log(`  📚 Educational Doc: ${educationalDocPath}`);

    return {
      success: true,
      gammaDocPath,
      educationalDocPath,
    };

  } catch (error: any) {
    console.error('[Document Generators] ❌ Failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Helper: Create a simple section from markdown text
 */
export function createSimpleSection(
  heading: string,
  content: string,
  images?: TableFigure[]
): DocumentSection {
  return {
    heading,
    content,
    images: images ? tableFiguresToImageData(images) : [],
  };
}

/**
 * Helper: Create an educational section with full explanations
 */
export function createEducationalSection(
  heading: string,
  content: string,
  explanations: Record<string, string>,
  teachingNotes: string[],
  checklistItems: ChecklistItem[],
  images?: TableFigure[]
): DocumentSection {
  return {
    heading,
    content,
    explanations,
    teaching_notes: teachingNotes,
    checklist_items: checklistItems,
    images: images ? tableFiguresToImageData(images) : [],
  };
}
