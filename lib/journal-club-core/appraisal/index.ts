/**
 * Critical Appraisal Module - Main Entry Point
 * 3-Tier Evidence-Based Appraisal System
 */

export * from './study-type-detector';
export * from './casp-checklists';
export * from './rob2-assessment';
export * from './equator-compliance';

import { detectStudyType, StudyTypeResult } from './study-type-detector';
import { performCASPAssessment, CASPResult } from './casp-checklists';
import { performRoB2Assessment, RoB2Result } from './rob2-assessment';
import { checkEquatorCompliance, EquatorResult } from './equator-compliance';

export interface ComprehensiveAppraisal {
  studyType: StudyTypeResult;
  tier1_CASP: CASPResult;
  tier2_RoB2?: RoB2Result; // Only for RCTs
  tier3_EQUATOR: EquatorResult;
}

/**
 * Perform comprehensive 3-tier critical appraisal
 */
export async function performComprehensiveAppraisal(
  paperText: string
): Promise<ComprehensiveAppraisal> {
  console.log('[Comprehensive Appraisal] Starting 3-tier assessment...');
  const startTime = Date.now();
  
  // Step 1: Detect study type
  const studyType = await detectStudyType(paperText);
  console.log(`[Comprehensive Appraisal] Study type: ${studyType.studyType} → ${studyType.equatorGuideline}`);
  
  // Step 2: Run all tiers in parallel for speed
  const [tier1_CASP, tier2_RoB2, tier3_EQUATOR] = await Promise.all([
    // Tier 1: CASP (Quick appraisal)
    performCASPAssessment(paperText, studyType.studyType),
    
    // Tier 2: RoB 2 (Only for RCTs)
    studyType.studyType === 'rct' ? performRoB2Assessment(paperText) : Promise.resolve(undefined),
    
    // Tier 3: EQUATOR (Full compliance)
    checkEquatorCompliance(paperText, studyType.equatorGuideline),
  ]);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Comprehensive Appraisal] ✅ All 3 tiers complete in ${duration}s`);
  
  return {
    studyType,
    tier1_CASP,
    tier2_RoB2,
    tier3_EQUATOR,
  };
}
