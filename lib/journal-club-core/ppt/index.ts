/**
 * PPT Generation Module
 * Converts critical appraisal to PowerPoint presentation
 */

export * from './slide-formatter';
export * from './presenton-client';

import { formatForPresentation } from './slide-formatter';
import { createPresentonClient, GeneratePPTOptions } from './presenton-client';
import { GeneratedAppraisal } from '../text-generator';

/**
 * Generate PowerPoint presentation from critical appraisal
 */
export async function generatePPTFromAppraisal(
  appraisal: GeneratedAppraisal,
  paperTitle: string,
  doi?: string,
  options?: GeneratePPTOptions
): Promise<Buffer> {
  console.log('[PPT Generator] Starting presentation generation...');
  
  // Format content for slides
  const presentation = formatForPresentation(appraisal, paperTitle, doi);
  console.log(`[PPT Generator] Formatted ${presentation.totalSlides} slides`);
  
  // Generate PPT using Presenton (local or cloud)
  const client = createPresentonClient();
  const pptBuffer = await client.generatePresentation(presentation, options);
  console.log('[PPT Generator] ✅ Presentation generated successfully');
  
  return pptBuffer;
}
