/**
 * Vision-Based Table & Figure Extractor
 * Uses Groq Vision API (Llama 4 Scout) to extract and explain tables/figures from PDFs
 */

import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const execFileAsync = promisify(execFile);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface TableFigure {
  pageNumber: number;
  type: 'table' | 'figure' | 'flowchart' | 'graph';
  title: string;
  explanation: string;
  imageBase64?: string;
  relevanceScore: number; // 0-10, how important for critical appraisal
}

export interface VisionExtractionResult {
  success: boolean;
  tablesFigures?: TableFigure[];
  error?: string;
  processingTime?: number;
}

/**
 * Convert PDF pages to images using pdf2image (Python)
 */
async function pdfToImages(pdfPath: string, outputDir: string): Promise<string[]> {
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Call pdf2image via Python
    const pythonScript = `
import sys
from pdf2image import convert_from_path
import os

pdf_path = sys.argv[1]
output_dir = sys.argv[2]

# Convert PDF to images (300 DPI for good quality)
images = convert_from_path(pdf_path, dpi=300)

# Save images and print paths
image_paths = []
for i, image in enumerate(images, start=1):
    img_path = os.path.join(output_dir, f'page_{i}.png')
    image.save(img_path, 'PNG')
    image_paths.append(img_path)

# Print paths as JSON array
import json
print(json.dumps(image_paths))
`;

    const scriptPath = path.join(outputDir, 'convert.py');
    await fs.writeFile(scriptPath, pythonScript);

    const { stdout } = await execFileAsync('python', [scriptPath, pdfPath, outputDir], {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 120000, // 2 minute timeout
    });

    const imagePaths: string[] = JSON.parse(stdout.trim());
    console.log(`[Vision Extractor] Converted ${imagePaths.length} pages to images`);

    return imagePaths;
  } catch (error: any) {
    throw new Error(`PDF to image conversion failed: ${error.message}`);
  }
}

/**
 * Analyze a single page image for tables/figures using Groq Vision
 */
async function analyzePage(
  imagePath: string,
  pageNumber: number
): Promise<TableFigure[]> {
  try {
    // Read image and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Call Groq Vision API (using Llama 4 Scout)
    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url' as const,
              image_url: { url: dataUrl },
            },
            {
              type: 'text' as const,
              text: `You are a medical research expert analyzing a page from a clinical trial paper.

TASK: Identify ONLY actual visual elements - tables, figures, graphs, flowcharts, and diagrams.

EXTRACT ONLY IF:
✓ It's a TABLE with rows/columns of data
✓ It's a FIGURE with visual data (graphs, charts, images, diagrams)
✓ It's a FLOWCHART (CONSORT, study design, etc.)
✓ It's a KAPLAN-MEIER survival curve
✓ It's a FOREST PLOT or other statistical visualization

DO NOT EXTRACT:
✗ Plain text paragraphs or sections
✗ Headers, footers, page numbers
✗ References or citations
✗ Author names or affiliations
✗ Abstract text

RELEVANCE SCORING (be strict):
- 10: Primary outcome data, CONSORT diagram, baseline characteristics table
- 9: Secondary outcomes, subgroup analysis, key figures showing main results
- 8: Important methodology tables, forest plots, survival curves
- 7: Supporting data, supplementary important figures
- 6 or below: DO NOT INCLUDE (not important enough)

For EACH valid visual element found, provide:
1. Type: "table", "figure", "flowchart", or "graph"
2. Title: Exact caption from the paper (e.g., "Table 2. Primary and Secondary Outcomes")
3. Explanation: What data/information this visual shows and why it matters (2-3 sentences)
4. Relevance Score: 1-10 based on importance

Return ONLY a JSON array:
[
  {
    "type": "table",
    "title": "Table 1. Baseline Characteristics of Patients",
    "explanation": "Compares demographic and clinical characteristics between dapagliflozin and placebo groups at study entry. Shows groups were well-balanced with similar age, sex distribution, ejection fraction, and comorbidities. Critical for assessing randomization quality.",
    "relevanceScore": 10
  }
]

If NO important visual elements (score >= 8) are found on this page, return: []`,
            },
          ] as any, // Type assertion for vision API support
        },
      ],
      temperature: 0.3, // Low temperature for consistent extraction
      max_tokens: 2000,
    } as any); // Type assertion for vision model support

    const content = response.choices[0]?.message?.content || '[]';

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log(`[Vision] Page ${pageNumber}: No tables/figures found`);
      return [];
    }

    const items: any[] = JSON.parse(jsonMatch[0]);

    // Filter out invalid extractions
    const validItems = items.filter(item => {
      const title = (item.title || '').toLowerCase();
      const explanation = (item.explanation || '').toLowerCase();

      // Reject if title/explanation suggests it's just text or a full page
      const invalidPatterns = [
        'entire page', 'full page', 'text only', 'no figure',
        'abstract', 'references', 'author', 'affiliation',
        'discussion section', 'methods section', 'results section'
      ];

      const isInvalid = invalidPatterns.some(pattern =>
        title.includes(pattern) || explanation.includes(pattern)
      );

      // Reject very generic titles
      const isGeneric = title.length < 10 || !title.match(/\d/); // Should have numbers like "Table 1" or "Figure 2"

      return !isInvalid && !isGeneric;
    });

    // Add page number to each valid item
    // NOTE: NOT including full page image - would need proper cropping to extract just the figure
    // For now, vision model provides descriptions/titles, actual images would need PyMuPDF extraction
    const tablesFigures: TableFigure[] = validItems.map(item => ({
      pageNumber,
      type: item.type,
      title: item.title,
      explanation: item.explanation,
      imageBase64: undefined, // Don't include full page screenshot
      relevanceScore: item.relevanceScore || 5,
    }));

    console.log(`[Vision] Page ${pageNumber}: Found ${tablesFigures.length} valid tables/figures (descriptions only)`);
    return tablesFigures;
  } catch (error: any) {
    console.error(`[Vision] Error analyzing page ${pageNumber}:`, error.message);
    return [];
  }
}


/**
 * Extract all tables and figures from a PDF using vision analysis
 */
export async function extractTablesAndFigures(pdfPath: string): Promise<VisionExtractionResult> {
  const startTime = Date.now();
  console.log(`[Vision Extractor] Starting extraction: ${pdfPath}`);

  try {
    // Create temp directory for images
    const tempDir = path.join(path.dirname(pdfPath), 'vision_temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Convert PDF to images
    const imagePaths = await pdfToImages(pdfPath, tempDir);

    // Analyze each page in parallel (limit to first 15 pages for speed)
    const pagesToAnalyze = imagePaths.slice(0, 15);
    console.log(`[Vision Extractor] Analyzing ${pagesToAnalyze.length} pages in parallel...`);

    const analysisPromises = pagesToAnalyze.map((imgPath, index) =>
      analyzePage(imgPath, index + 1)
    );

    const results = await Promise.all(analysisPromises);

    // Flatten results and filter by relevance (keep only highly important items with score >= 8)
    const allTablesFigures = results
      .flat()
      .filter(item => item.relevanceScore >= 8)
      .sort((a, b) => b.relevanceScore - a.relevanceScore); // Sort by importance

    // Cleanup temp images
    await fs.rm(tempDir, { recursive: true, force: true });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[Vision Extractor] ✅ Complete in ${duration}s - Found ${allTablesFigures.length} important tables/figures`
    );

    return {
      success: true,
      tablesFigures: allTablesFigures,
      processingTime: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error(`[Vision Extractor] ❌ Failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
