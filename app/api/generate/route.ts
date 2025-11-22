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
async function generateAppraisal(paper: { title: string; abstract: string; authors: string[] }): Promise<string> {
  const prompt = `You are an expert medical researcher. Generate a comprehensive journal club critical appraisal for this research paper.

**Paper Title:** ${paper.title}

**Authors:** ${paper.authors.join(', ')}

**Abstract:** ${paper.abstract}

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

    // Poll for completion
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
        console.error('[Gamma] Generation failed');
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('[Gamma] Error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input) {
      return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 });
    }

    const isDoi = input.match(/^10\.\d{4,}/);
    if (!isDoi) {
      return NextResponse.json({
        success: false,
        error: 'Currently only DOI input is supported. Enter a DOI like 10.1056/NEJMoa2302392'
      }, { status: 400 });
    }

    console.log(`[Generate] Starting for DOI: ${input}`);

    // Step 1: Fetch paper metadata
    const paper = await fetchPaperAbstract(input.trim());
    console.log(`[Generate] Fetched: ${paper.title}`);

    // Step 2: Generate critical appraisal
    const gammaMarkdown = await generateAppraisal(paper);
    console.log(`[Generate] Generated ${gammaMarkdown.length} chars`);

    // Step 3: Create Gamma presentation (if API key available)
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
  }
}

export const maxDuration = 120;
