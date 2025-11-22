import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Check if input is a DOI or URL
function parseInput(input: string): { type: 'doi' | 'url'; value: string } {
  if (input.match(/^10\.\d{4,}/)) {
    return { type: 'doi', value: input };
  }
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return { type: 'url', value: input };
  }
  return { type: 'doi', value: input };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input) {
      return NextResponse.json({ success: false, error: 'Input is required' }, { status: 400 });
    }

    const parsed = parseInput(input.trim());

    // Create output directory
    const outputDir = path.join(process.cwd(), 'output', Date.now().toString());
    await fs.mkdir(outputDir, { recursive: true });

    // Build the command to run the CLI from Journal_Club_V2
    // In production, this would be integrated directly, but for now we call the CLI
    const journalClubPath = process.env.JOURNAL_CLUB_PATH || 'D:\\Claude\\Projects\\Journal_Club_V2';

    const command = parsed.type === 'doi'
      ? `cd "${journalClubPath}" && npm run generate-full -- --doi "${parsed.value}" --output "${outputDir}"`
      : `cd "${journalClubPath}" && npm run generate-full -- --url "${parsed.value}" --output "${outputDir}"`;

    console.log('Running command:', command);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minute timeout
      maxBuffer: 50 * 1024 * 1024,
    });

    console.log('stdout:', stdout);
    if (stderr) console.log('stderr:', stderr);

    // Find generated files
    const files = await fs.readdir(outputDir);
    const gammaFile = files.find(f => f.endsWith('_Gamma.md'));
    const educationalFile = files.find(f => f.endsWith('_Educational.docx'));

    if (!gammaFile) {
      return NextResponse.json({
        success: false,
        error: 'Generation failed - no output files created'
      }, { status: 500 });
    }

    // Read gamma markdown
    const gammaMarkdown = await fs.readFile(path.join(outputDir, gammaFile), 'utf-8');

    return NextResponse.json({
      success: true,
      gammaMarkdown,
      educationalDocPath: educationalFile ? path.join(outputDir, educationalFile) : null,
      outputDir,
    });
  } catch (error: unknown) {
    console.error('Generate error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export const maxDuration = 120; // Allow up to 2 minutes for generation
