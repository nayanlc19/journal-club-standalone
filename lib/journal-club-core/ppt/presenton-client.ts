/**
 * Presenton API Client
 * Generates PowerPoint presentations from structured content
 */

import fetch from 'node-fetch';
import { PresentationStructure } from './slide-formatter.js';

export interface PresentonConfig {
  baseUrl?: string;
  apiKey?: string; // Optional - not needed for local instance
}

export interface GeneratePPTOptions {
  tone?: 'default' | 'casual' | 'professional' | 'funny' | 'educational' | 'sales_pitch';
  verbosity?: 'concise' | 'standard' | 'text-heavy';
  template?: string;
  exportAs?: 'pptx' | 'pdf';
}

/**
 * Presenton API Client
 * Works with local Presenton instance (default: http://localhost:5000)
 * Or cloud Presenton API (requires API key)
 */
export class PresentonClient {
  private apiKey?: string;
  private baseUrl: string;

  constructor(config: PresentonConfig = {}) {
    this.apiKey = config.apiKey;
    // Default to local instance (port 8000 as per Dockerfile)
    this.baseUrl = config.baseUrl || process.env.PRESENTON_URL || 'http://localhost:8000';
  }

  /**
   * Generate PowerPoint from structured presentation content
   */
  async generatePresentation(
    presentation: PresentationStructure,
    options: GeneratePPTOptions = {}
  ): Promise<Buffer> {
    console.log('[Presenton] Generating presentation...');
    console.log(`[Presenton] Title: ${presentation.title}`);
    console.log(`[Presenton] Slides: ${presentation.totalSlides}`);
    
    // Build prompt from slides
    const prompt = this.buildPromptFromSlides(presentation);
    
    const requestBody = {
      content: prompt,  // Presenton API expects 'content', not 'prompt'
      n_slides: presentation.totalSlides,
      language: 'English',
      tone: options.tone || 'professional',
      verbosity: options.verbosity || 'standard',
      template: options.template || 'general',
      export_as: options.exportAs || 'pptx',
    };
    
    try {
      // Build headers (Authorization only for cloud API)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      
      const response = await fetch(`${this.baseUrl}/api/v1/ppt/presentation/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Presenton API error: ${response.status} - ${errorText}`);
      }

      const pptBuffer = await response.buffer();
      console.log(`[Presenton] ✅ Generated ${pptBuffer.length} bytes PPTX`);
      
      return pptBuffer;
    } catch (error) {
      console.error('[Presenton] ❌ Generation failed:', error);
      throw error;
    }
  }

  /**
   * Build structured prompt from presentation slides
   */
  private buildPromptFromSlides(presentation: PresentationStructure): string {
    let prompt = `# ${presentation.title}\n${presentation.subtitle}\n\n`;
    
    presentation.slides.forEach(slide => {
      prompt += `## Slide ${slide.slideNumber}: ${slide.title}\n\n`;
      
      // Add bullet points
      slide.bulletPoints.forEach(bullet => {
        prompt += `- ${bullet}\n`;
      });
      
      prompt += `\n**Speaker Notes:** ${slide.notes}\n\n`;
      
      // Note about images
      if (slide.imageUrl) {
        prompt += `**Image:** Include relevant visual/table/figure here\n\n`;
      }
      
      prompt += `---\n\n`;
    });
    
    return prompt;
  }
}

/**
 * Create Presenton client from environment
 * Works with local instance (no API key needed) or cloud API (requires key)
 */
export function createPresentonClient(): PresentonClient {
  const apiKey = process.env.PRESENTON_API_KEY;
  const baseUrl = process.env.PRESENTON_URL || 'http://localhost:5000';
  
  if (apiKey) {
    console.log('[Presenton] Using cloud API with authentication');
    return new PresentonClient({ apiKey, baseUrl });
  } else {
    console.log(`[Presenton] Using local instance at ${baseUrl}`);
    return new PresentonClient({ baseUrl });
  }
}
