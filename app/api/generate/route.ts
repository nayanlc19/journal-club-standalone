import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// Lazy init to avoid build-time errors
let groq: Groq | null = null;
function getGroq() {
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

// Fetch paper text from CrossRef or publisher
async function fetchPaperAbstract(doi: string): Promise<{ title: string; abstract: string; authors: string[] }> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!res.ok) throw new Error('CrossRef lookup failed');

    const data = await res.json();
    const work = data.message;

    return {
      title: work.title?.[0] || 'Unknown Title',
      abstract: work.abstract || 'No abstract available',
      authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`).slice(0, 5) || [],
    };
  } catch (error) {
    console.error('[Generate] CrossRef fetch failed:', error);
    throw error;
  }
}

// Generate critical appraisal using Groq
async function generateAppraisal(paper: { title: string; abstract: string; authors: string[] }): Promise<string> {
  const prompt = `You are an expert medical researcher. Generate a comprehensive journal club critical appraisal for this research paper.

**Paper Title:** ${paper.title}

**Authors:** ${paper.authors.join(', ')}

**Abstract:** ${paper.abstract}

Generate a structured critical appraisal with these sections:
1. **Study Overview** - Brief summary of the study
2. **PICO Framework** - Population, Intervention, Comparison, Outcome
3. **Study Design** - Type of study and methodology
4. **Key Findings** - Main results and statistics
5. **Strengths** - What the study did well
6. **Limitations** - Weaknesses and biases
7. **Clinical Implications** - How this applies to practice
8. **Questions for Discussion** - 3-5 thought-provoking questions

Format as clean markdown for presentation slides.`;

  const completion = await getGroq().chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    max_tokens: 4000,
    temperature: 0.3,
  });

  return completion.choices[0]?.message?.content || 'Generation failed';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input) {
      return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 });
    }

    // Check if DOI
    const isDoi = input.match(/^10\.\d{4,}/);

    if (!isDoi) {
      return NextResponse.json({
        success: false,
        error: 'Currently only DOI input is supported. Please enter a DOI like 10.1056/NEJMoa2302392'
      }, { status: 400 });
    }

    console.log(`[Generate] Starting for DOI: ${input}`);

    // Fetch paper metadata
    const paper = await fetchPaperAbstract(input.trim());
    console.log(`[Generate] Fetched paper: ${paper.title}`);

    // Generate appraisal
    const gammaMarkdown = await generateAppraisal(paper);
    console.log(`[Generate] Generated ${gammaMarkdown.length} chars of markdown`);

    return NextResponse.json({
      success: true,
      gammaMarkdown,
      educationalDocPath: null, // Word doc generation not yet implemented
    });

  } catch (error: unknown) {
    console.error('[Generate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export const maxDuration = 60;
