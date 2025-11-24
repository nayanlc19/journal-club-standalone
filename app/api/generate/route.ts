import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { readFile, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateRequestId, logGeneration, logStep, categorizeError } from '@/lib/generation-logger';

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

// Generate educational Word document
async function generateEducationalDoc(appraisal: string, paperTitle: string, authors: string[]): Promise<Buffer> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');

  const sections = appraisal.split(/\n##\s+/).filter(s => s.trim());
  const paragraphs: any[] = [];

  // Add title
  paragraphs.push(new Paragraph({
    text: `Educational Summary: ${paperTitle}`,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 }
  }));

  // Add authors
  paragraphs.push(new Paragraph({
    text: `By: ${authors.join(', ')}`,
    spacing: { after: 400 }
  }));

  // Add sections
  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0]?.trim() || 'Section';

    paragraphs.push(new Paragraph({
      text: heading,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (line) {
        paragraphs.push(new Paragraph({
          text: line.replace(/^\*\*/, '').replace(/\*\*$/, ''),
          spacing: { after: 100 }
        }));
      }
    }
  }

  // Add Q&A section
  paragraphs.push(new Paragraph({
    text: 'Defense Questions & Answers',
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 100 }
  }));

  paragraphs.push(new Paragraph({
    text: 'These questions help you prepare for journal club discussion:',
    spacing: { after: 100 }
  }));

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

// Upload file to Supabase Storage
async function uploadToSupabase(fileName: string, fileBuffer: Buffer, contentType: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const bucketName = 'journal-club-files';

  try {
    // Create bucket if it doesn't exist (idempotent)
    await supabase.storage.createBucket(bucketName, { public: false }).catch(() => {});

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) throw error;

    console.log(`[Supabase] Uploaded: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error(`[Supabase] Upload failed:`, error);
    throw error;
  }
}

// Create signed download URL from Supabase
async function getSignedUrl(fileName: string, expiresIn: number = 172800): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const bucketName = 'journal-club-files';

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(fileName, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

// Send email via Resend
async function sendDownloadEmail(email: string, paperTitle: string, pptUrl: string, docxUrl: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('Resend API key not configured');
  }

  const resend = new Resend(resendApiKey);

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Your Journal Club Documents are Ready!</h1>
      <p style="color: #666; font-size: 16px;">
        We've generated your critical appraisal documents for:
      </p>
      <p style="background: #f5f5f5; padding: 12px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
        <strong>${paperTitle}</strong>
      </p>

      <h2 style="color: #333; margin-top: 30px;">Download Your Documents:</h2>

      <table style="width: 100%; margin: 20px 0;">
        <tr>
          <td style="padding: 12px;">
            <a href="${pptUrl}" style="background: #0ea5e9; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
              📊 Download PowerPoint
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px;">
            <a href="${docxUrl}" style="background: #10b981; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
              📄 Download Word Document
            </a>
          </td>
        </tr>
      </table>

      <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
        <strong>Note:</strong> Download links expire after 48 hours. If you don't see this email in your inbox, check your spam folder.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: 'SmartDNBPrep <noreply@smartdnbprep.com>',
    to: email,
    subject: `Journal Club: ${paperTitle}`,
    html: emailHtml,
  });

  console.log(`[Email] Sent to: ${email}`);
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
  const requestId = generateRequestId();
  const startTime = Date.now();
  let paperTitle = '';
  let inputType: 'doi' | 'pdf' | 'topic' = 'doi';

  try {
    logStep(requestId, 'Parsing request', 1);
    const body = await request.json();
    const { input, isPdfUpload, email } = body;

    if (!input) {
      return NextResponse.json({
        success: false,
        error: 'Input is required',
        requestId
      }, { status: 400 });
    }

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({
        success: false,
        error: 'Valid email is required',
        requestId
      }, { status: 400 });
    }

    logStep(requestId, 'Creating Supabase client', 2);

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

    if (!gammaResult?.url) {
      throw new Error('Failed to generate PowerPoint presentation');
    }

    // Generate educational Word document
    const docBuffer = await generateEducationalDoc(gammaMarkdown, paper.title, paper.authors);
    console.log(`[Generate] Generated Word doc: ${docBuffer.length} bytes`);

    // Download PPT from Gamma and upload to Supabase
    const timestamp = Date.now();
    const pptFileName = `ppt_${timestamp}.pptx`;
    const docxFileName = `doc_${timestamp}.docx`;

    // Download PPT from Gamma
    const pptRes = await fetch(gammaResult.url);
    if (!pptRes.ok) {
      throw new Error('Failed to download PPT from Gamma');
    }
    const pptBuffer = Buffer.from(await pptRes.arrayBuffer());

    // Upload both files to Supabase
    await uploadToSupabase(pptFileName, pptBuffer, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    await uploadToSupabase(docxFileName, docBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    // Create signed download URLs (48 hours)
    const pptSignedUrl = await getSignedUrl(pptFileName, 172800);
    const docxSignedUrl = await getSignedUrl(docxFileName, 172800);

    // Send email with download links
    logStep(requestId, 'Sending email via Resend', 5);
    await sendDownloadEmail(email, paper.title, pptSignedUrl, docxSignedUrl);

    // Log success
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      // Get user email for logging (we have it from request, but for completeness)
      const completedAt = new Date();
      await logGeneration(supabase, {
        userId: email, // Using email as fallback user identifier
        requestId,
        service: 'journal-club-standalone',
        mode: 'critical_appraisal',
        inputType,
        paperTitle: paper.title,
        status: 'success',
        emailSent: true,
        pptUrl: pptSignedUrl,
        wordUrl: docxSignedUrl,
        completedAt,
      }).catch(err => console.error('[Log] Failed to log success:', err));
    }

    return NextResponse.json({
      success: true,
      requestId,
      message: `Email sent to ${email}`,
      gammaMarkdown, // Include for debugging
    });

  } catch (error: unknown) {
    console.error(`[${requestId}] Error:`, error);
    const { code, message, stack } = categorizeError(error);

    // Log failure
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const body = await request.json().catch(() => ({}));
      const email = (body as any).email || 'unknown@example.com';
      const completedAt = new Date();
      await logGeneration(supabase, {
        userId: email,
        requestId,
        service: 'journal-club-standalone',
        mode: 'critical_appraisal',
        inputType,
        paperTitle,
        status: 'failed',
        currentStep: 'unknown',
        errorCode: code,
        errorMessage: message,
        errorStack: stack,
        completedAt,
      }).catch(err => console.error('[Log] Failed to log error:', err));
    }

    return NextResponse.json({
      success: false,
      error: message,
      requestId,
      errorCode: code,
      step: 'unknown'
    }, { status: 500 });
  } finally {
    // Clean up uploaded PDF file after processing
    if (pdfFilePath) {
      await cleanupFile(pdfFilePath);
    }
  }
}

export const maxDuration = 120;
