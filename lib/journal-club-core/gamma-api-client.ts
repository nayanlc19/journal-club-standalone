/**
 * Gamma API Client
 * Create presentations programmatically using Gamma's Generate API
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import FormData from 'form-data';

export interface GammaGenerateOptions {
  content: string; // Markdown or text content
  title: string;
  type?: 'presentation' | 'document' | 'webpage' | 'social';
  themeId?: string;
  folderIds?: string[];
  pdfPath?: string; // Optional PDF for image extraction
}

export interface GammaGenerateResult {
  success: boolean;
  url?: string;
  id?: string;
  error?: string;
}

/**
 * Create a Gamma presentation using the API
 */
export async function createGammaPresentation(
  apiKey: string,
  options: GammaGenerateOptions
): Promise<GammaGenerateResult> {
  try {
    console.log('[Gamma API] Creating presentation...');

    // Fetch consultant theme if no theme specified
    let themeId = options.themeId;
    if (!themeId) {
      console.log('[Gamma API] Fetching "consultant" theme...');
      const themes = await listGammaThemes(apiKey);
      const consultantTheme = themes.find(t =>
        t.name?.toLowerCase().includes('consultant') ||
        t.title?.toLowerCase().includes('consultant')
      );

      if (consultantTheme) {
        themeId = consultantTheme.id || consultantTheme.themeId;
        console.log(`[Gamma API] Using consultant theme: ${themeId}`);
      } else {
        console.log('[Gamma API] ⚠️ Consultant theme not found, using default');
      }
    }

    // Prepare request body with correct Gamma API parameters
    const requestBody: any = {
      inputText: `# ${options.title}\n\n${options.content}`,
      textMode: 'preserve', // Keep our formatted text as-is
      format: options.type || 'presentation',
      numCards: 20, // Control slide count (max 20 slides for proportional content)
      imageOptions: {
        source: 'noImages', // CRITICAL: Disable AI image generation to save credits
      },
      cardOptions: {
        dimensions: '16x9', // Traditional 16:9 presentation format
      },
      exportAs: 'pptx', // Export as editable PowerPoint file
    };

    if (themeId) {
      requestBody.themeId = themeId;
    }

    if (options.folderIds && options.folderIds.length > 0) {
      requestBody.folderIds = options.folderIds;
    }

    // Note: Gamma API does NOT support PDF upload
    if (options.pdfPath) {
      console.log('[Gamma API] ⚠️ Note: Gamma API cannot upload PDFs - images must be added manually');
    }

    // Make API request
    const response = await fetch('https://public-api.gamma.app/v1.0/generations', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gamma API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    console.log('[Gamma API] ✅ Presentation created successfully!');
    console.log('[Gamma API] Response:', JSON.stringify(result, null, 2));

    return {
      success: true,
      url: result.url || result.viewUrl || result.webUrl,
      id: result.id || result.generationId,
    };

  } catch (error: any) {
    console.error('[Gamma API] ❌ Failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check generation status and get the URL
 */
export async function getGenerationStatus(
  apiKey: string,
  generationId: string
): Promise<any> {
  try {
    const response = await fetch(
      `https://public-api.gamma.app/v1.0/generations/${generationId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get generation status: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[Gamma API] Failed to get generation status:', error.message);
    throw error;
  }
}

/**
 * Wait for generation to complete and return URLs
 */
export async function waitForGeneration(
  apiKey: string,
  generationId: string,
  maxWaitSeconds: number = 180
): Promise<{ gammaUrl: string; pptxUrl?: string }> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getGenerationStatus(apiKey, generationId);

    console.log(`[Gamma API] Status: ${status.status || 'unknown'}`);

    if (status.status === 'completed' || status.status === 'success') {
      const gammaUrl = status.gammaUrl || status.webUrl || status.url || status.viewUrl;

      // Wait extra time for PPTX export to be ready (120 seconds recommended)
      console.log('[Gamma API] Waiting for PPTX export to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 more seconds

      // Poll one more time to get export URLs
      const finalStatus = await getGenerationStatus(apiKey, generationId);

      console.log('[Gamma API] Final status:', JSON.stringify(finalStatus, null, 2));

      const pptxUrl = finalStatus.exportUrl || finalStatus.pptxUrl || finalStatus.exportUrls?.pptx || finalStatus.files?.pptx;

      return {
        gammaUrl,
        pptxUrl,
      };
    }

    if (status.status === 'failed' || status.status === 'error') {
      const errorDetails = typeof status.error === 'object'
        ? JSON.stringify(status.error, null, 2)
        : status.error || 'Unknown error';
      throw new Error(`Generation failed: ${errorDetails}`);
    }

    // Wait 3 seconds before next poll (longer for PPTX generation)
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('Generation timeout - took longer than expected');
}

/**
 * Download PPTX file from URL
 */
export async function downloadPPTX(
  pptxUrl: string,
  outputPath: string
): Promise<void> {
  try {
    console.log('[Gamma API] Downloading PPTX file...');

    const response = await fetch(pptxUrl);

    if (!response.ok) {
      throw new Error(`Failed to download PPTX: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));

    console.log(`[Gamma API] ✅ PPTX saved to: ${outputPath}`);
  } catch (error: any) {
    console.error('[Gamma API] Failed to download PPTX:', error.message);
    throw error;
  }
}

/**
 * Get current credit balance by checking latest generation
 * Note: Gamma API doesn't have a dedicated /credits endpoint
 * This fetches the most recent generation to see remaining credits
 */
export async function getCurrentCreditBalance(apiKey: string): Promise<{ remaining: number }> {
  try {
    // List recent generations to get credit info
    const response = await fetch('https://public-api.gamma.app/v1.0/generations?limit=1', {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get credit balance: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract credits from most recent generation
    if (data.generations && data.generations.length > 0) {
      const latestGen = data.generations[0];
      if (latestGen.credits) {
        return { remaining: latestGen.credits.remaining };
      }
    }

    throw new Error('No generation history found to determine credit balance');
  } catch (error: any) {
    console.error('[Gamma API] Failed to get credit balance:', error.message);
    throw error;
  }
}

/**
 * List available themes
 */
export async function listGammaThemes(apiKey: string): Promise<any[]> {
  try {
    const response = await fetch('https://public-api.gamma.app/v1.0/themes', {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch themes: ${response.statusText}`);
    }

    const data = await response.json();
    const themes = data.themes || data.data || data || [];
    console.log(`[Gamma API] Found ${themes.length} themes`);
    return themes;

  } catch (error: any) {
    console.error('[Gamma API] Failed to list themes:', error.message);
    return [];
  }
}

/**
 * Convert Word document to markdown for Gamma API
 */
export async function convertWordToMarkdown(docxPath: string): Promise<string> {
  // For now, read the Word doc and extract text
  // In production, you'd use a proper DOCX to Markdown converter
  try {
    // Placeholder - would need proper conversion
    return `# Presentation from Journal Club\n\nContent will be extracted from Word document`;
  } catch (error) {
    throw new Error(`Failed to convert Word to Markdown: ${error}`);
  }
}
