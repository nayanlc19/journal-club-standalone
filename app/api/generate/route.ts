import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Shared DOI regex pattern
export const DOI_REGEX = /^10\.\d{4,}/;

// Lazy init to avoid build-time errors
let groq: Groq | null = null;
function getGroq() {
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

// Extract text from PDF using pdf-parse
async function extractPdfText(filePath: string): Promise<string> {
  // Security: Validate path is within uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
    throw new Error('Invalid file path');
  }

  if (!existsSync(filePath)) {
    throw new Error('PDF file not found');
  }

  const pdfBuffer = await readFile(filePath);
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  try {
    const textResult = await parser.getText();
    const fullText = textResult.pages.map(p => p.text).join('\n\n');
    console.log(`[PDF] Extracted ${fullText.length} chars from ${textResult.pages.length} pages`);
    return fullText;
  } finally {
    // Cleanup parser resources
    await parser.destroy().catch(() => {});
  }
}

// Clean up uploaded file after processing
async function cleanupFile(filePath: string): Promise<void> {
  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
      console.log(`[Cleanup] Deleted: ${filePath}`);
    }
  } catch (error) {
    console.error(`[Cleanup] Failed to delete ${filePath}:`, error);
  }
}

// Sanitize text content for LLM prompt (prevent prompt injection)
function sanitizeContent(text: string, maxLength: number = 30000): string {
  return text
    .substring(0, maxLength)
    .replace(/```/g, '~~~') // Escape code blocks
    .replace(/\*\*\s*(system|assistant|user)\s*:/gi, '$1:') // Remove role markers
    .trim();
}

// Fetch paper from CrossRef
async function fetchPaperAbstract(doi: string): Promise<{ title: string; abstract: string; authors: string[] }> {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!res.ok) throw new Error('CrossRef lookup failed');

  const data = await res.json();
  const work = data.message;

  return {
    title: work.title?.[0] || 'Unknown Title',
    abstract: work.abstract || 'No abstract available',
    authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`).slice(0, 5) || [],
  };
}

// Generate critical appraisal using Groq
async function generateAppraisal(paper: { title: string; content: string; authors: string[]; isFullText: boolean }): Promise<string> {
  const contentType = paper.isFullText ? 'Full Paper Text' : 'Abstract';

  const prompt = `You are an expert medical researcher. Generate a comprehensive journal club critical appraisal for this research paper.

**Paper Title:** ${paper.title}

**Authors:** ${paper.authors.join(', ')}

**${contentType}:** ${paper.content}

Generate a structured critical appraisal with these sections:
1. **Clinical Question (PICO)** - Population, Intervention, Comparison, Outcome
2. **Study Overview** - Brief summary of the study
3. **Study Design** - Type of study and methodology
4. **Key Findings** - Main results with statistics
5. **Strengths** - What the study did well
6. **Limitations** - Weaknesses and potential biases
7. **Clinical Implications** - How this applies to clinical practice
8. **Questions for Discussion** - 3-5 thought-provoking questions for journal club

Format as clean markdown suitable for Gamma presentation slides.`;

  const completion = await getGroq().chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    max_tokens: 4000,
    temperature: 0.3,
  });

  return completion.choices[0]?.message?.content || 'Generation failed';
}

// Call Gamma API to create presentation
async function createGammaPresentation(markdown: string, title: string): Promise<{ url: string; id: string } | null> {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) {
    console.log('[Generate] No GAMMA_API_KEY, skipping PPT generation');
    return null;
  }

  try {
    // Start generation
    const generateRes = await fetch('https://api.gamma.app/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputText: markdown,
        textMode: 'preserve',
        format: 'presentation',
        numCards: 20,
        additionalInstructions: 'Add critical appraisal checklist compulsorily',
        textOptions: {
          amount: 'detailed',
          tone: 'educational',
          audience: 'medical postgraduate students'
        },
        imageOptions: { source: 'noImages' },
        cardOptions: { dimensions: '16x9' },
        themeId: 'zephyr',
        exportAs: 'pptx'
      }),
    });

    if (!generateRes.ok) {
      const errorText = await generateRes.text();
      console.error('[Gamma] Generate failed:', errorText);
      return null;
    }

    const generateData = await generateRes.json();
    const generationId = generateData.id;
    console.log(`[Gamma] Generation started: ${generationId}`);

    // Poll for completion (60 iterations × 2s = 120s max)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const statusRes = await fetch(`https://api.gamma.app/v1/generations/${generationId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!statusRes.ok) continue;

      const status = await statusRes.json();
      if (status.status === 'completed' && status.outputUrl) {
        console.log(`[Gamma] Completed: ${status.outputUrl}`);
        return { url: status.outputUrl, id: generationId };
      } else if (status.status === 'failed') {
        console.error('[Gamma] Generation failed:', status.error || 'Unknown error');
        throw new Error('Gamma presentation generation failed');
      }
    }

    console.error('[Gamma] Generation timed out after 120 seconds');
    throw new Error('Gamma presentation generation timed out');
  } catch (error) {
    console.error('[Gamma] Error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  let pdfFilePath: string | null = null;

  try {
    const body = await request.json();
    const { input, isPdfUpload } = body;

    if (!input) {
      return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 });
    }

    let paper: { title: string; content: string; authors: string[]; isFullText: boolean };

    if (isPdfUpload) {
      // Handle uploaded PDF
      pdfFilePath = input; // Store for cleanup
      console.log(`[Generate] Processing uploaded PDF: ${input}`);

      const pdfText = await extractPdfText(input);

      // Extract title from first line (often the title) or use filename
      const lines = pdfText.split('\n').filter(l => l.trim());
      const title = sanitizeContent(lines[0] || 'Uploaded Paper', 200);

      paper = {
        title,
        content: sanitizeContent(pdfText), // Sanitize and limit content
        authors: ['From uploaded PDF'],
        isFullText: true,
      };

      console.log(`[Generate] Extracted ${pdfText.length} chars from PDF`);
    } else {
      // Handle DOI
      if (!DOI_REGEX.test(input)) {
        return NextResponse.json({
          success: false,
          error: 'Currently only DOI input is supported. Enter a DOI like 10.1056/NEJMoa2302392'
        }, { status: 400 });
      }

      console.log(`[Generate] Starting for DOI: ${input}`);

      const crossRefData = await fetchPaperAbstract(input.trim());
      paper = {
        title: sanitizeContent(crossRefData.title, 500),
        content: sanitizeContent(crossRefData.abstract, 10000),
        authors: crossRefData.authors,
        isFullText: false,
      };

      console.log(`[Generate] Fetched: ${paper.title}`);
    }

    // Generate critical appraisal
    const gammaMarkdown = await generateAppraisal(paper);
    console.log(`[Generate] Generated ${gammaMarkdown.length} chars`);

    // Create Gamma presentation (if API key available)
    const gammaResult = await createGammaPresentation(gammaMarkdown, paper.title);

    return NextResponse.json({
      success: true,
      gammaMarkdown,
      gammaPptUrl: gammaResult?.url || null,
      educationalDocPath: null, // Full pipeline needed for Word doc
    });

  } catch (error: unknown) {
    console.error('[Generate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  } finally {
    // Clean up uploaded PDF file after processing
    if (pdfFilePath) {
      await cleanupFile(pdfFilePath);
    }
  }
}

export const maxDuration = 120;
