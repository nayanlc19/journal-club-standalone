/**
 * Study Type Detector and EQUATOR Network Guideline Router
 * Maps study designs to appropriate reporting guidelines
 */

import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export type StudyType =
  | 'rct'
  | 'cohort'
  | 'case-control'
  | 'cross-sectional'
  | 'systematic-review'
  | 'meta-analysis'
  | 'diagnostic'
  | 'prognostic'
  | 'case-report'
  | 'qualitative'
  | 'animal-study'
  | 'economic-evaluation'
  | 'quality-improvement'
  | 'other';

export type EquatorGuideline =
  | 'CONSORT'     // RCTs
  | 'STROBE'      // Observational (cohort, case-control, cross-sectional)
  | 'PRISMA'      // Systematic reviews and meta-analyses
  | 'STARD'       // Diagnostic accuracy studies
  | 'TRIPOD'      // Prognostic studies
  | 'CARE'        // Case reports
  | 'SRQR'        // Qualitative research
  | 'COREQ'       // Qualitative research (alternative)
  | 'ARRIVE'      // Animal research
  | 'CHEERS'      // Economic evaluations
  | 'SQUIRE'      // Quality improvement
  | 'NONE';       // No specific guideline

export interface StudyTypeResult {
  studyType: StudyType;
  confidence: 'high' | 'medium' | 'low';
  equatorGuideline: EquatorGuideline;
  reasoning: string;
  keywords: string[];
}

/**
 * EQUATOR Network Study Type to Guideline Mapping
 * Based on official EQUATOR Network recommendations (2024)
 */
export const EQUATOR_MAPPING: Record<StudyType, EquatorGuideline> = {
  'rct': 'CONSORT',
  'cohort': 'STROBE',
  'case-control': 'STROBE',
  'cross-sectional': 'STROBE',
  'systematic-review': 'PRISMA',
  'meta-analysis': 'PRISMA',
  'diagnostic': 'STARD',
  'prognostic': 'TRIPOD',
  'case-report': 'CARE',
  'qualitative': 'SRQR',
  'animal-study': 'ARRIVE',
  'economic-evaluation': 'CHEERS',
  'quality-improvement': 'SQUIRE',
  'other': 'NONE',
};

/**
 * Guideline descriptions for student understanding
 */
export const GUIDELINE_DESCRIPTIONS: Record<EquatorGuideline, string> = {
  'CONSORT': 'Consolidated Standards of Reporting Trials - For randomized controlled trials',
  'STROBE': 'Strengthening the Reporting of Observational Studies in Epidemiology - For cohort, case-control, and cross-sectional studies',
  'PRISMA': 'Preferred Reporting Items for Systematic Reviews and Meta-Analyses',
  'STARD': 'Standards for Reporting of Diagnostic Accuracy Studies',
  'TRIPOD': 'Transparent Reporting of a multivariable prediction model for Individual Prognosis Or Diagnosis',
  'CARE': 'Case Report guidelines',
  'SRQR': 'Standards for Reporting Qualitative Research',
  'COREQ': 'Consolidated criteria for Reporting Qualitative research',
  'ARRIVE': 'Animal Research: Reporting of In Vivo Experiments',
  'CHEERS': 'Consolidated Health Economic Evaluation Reporting Standards',
  'SQUIRE': 'Standards for QUality Improvement Reporting Excellence',
  'NONE': 'No specific EQUATOR guideline applies',
};

/**
 * Extract methods/abstract section for focused analysis
 */
function extractMethodsSection(paperText: string): string {
  const text = paperText.toLowerCase();

  // Try to extract methods section (more accurate than full text)
  const methodsStart = text.search(/\b(methods?|study design|participants?|materials? and methods?)\b/);
  const resultsStart = text.search(/\b(results?|findings?|outcomes?)\b/);

  if (methodsStart !== -1 && resultsStart !== -1 && resultsStart > methodsStart) {
    // Extract methods section only
    return text.substring(methodsStart, resultsStart);
  }

  // Fallback: use first 3000 chars (likely includes abstract + methods)
  return text.substring(0, 3000);
}

/**
 * Quick keyword-based detection (Tier 1 - Fast)
 * IMPROVED: Contextual detection with reordered priority
 */
export function quickDetectStudyType(paperText: string): StudyTypeResult | null {
  const text = paperText.toLowerCase();
  const methodsSection = extractMethodsSection(paperText);

  // PRIORITY 1: RCT (highest priority - very distinctive)
  if ((methodsSection.includes('randomized') || methodsSection.includes('randomised')) &&
      (methodsSection.includes('control') || methodsSection.includes('trial'))) {
    return {
      studyType: 'rct',
      confidence: 'high',
      equatorGuideline: 'CONSORT',
      reasoning: 'Keywords in methods: randomized + controlled trial',
      keywords: ['randomized', 'controlled trial', 'RCT'],
    };
  }

  // PRIORITY 2: Observational studies (check BEFORE meta-analysis to avoid false positives)

  // Cross-sectional study (check first - very specific)
  if (methodsSection.includes('cross-sectional') || methodsSection.includes('cross sectional')) {
    return {
      studyType: 'cross-sectional',
      confidence: 'high',
      equatorGuideline: 'STROBE',
      reasoning: 'Keywords in methods: cross-sectional study',
      keywords: ['cross-sectional', 'STROBE'],
    };
  }

  // Cohort study
  if (methodsSection.includes('cohort') &&
      (methodsSection.includes('follow') || methodsSection.includes('longitudinal') ||
       methodsSection.includes('prospective') || methodsSection.includes('retrospective'))) {
    return {
      studyType: 'cohort',
      confidence: 'high',
      equatorGuideline: 'STROBE',
      reasoning: 'Keywords in methods: cohort + follow-up/longitudinal',
      keywords: ['cohort', 'longitudinal', 'prospective'],
    };
  }

  // Case-control study
  if (methodsSection.includes('case-control') ||
      (methodsSection.includes('cases') && methodsSection.includes('controls') && !methodsSection.includes('randomized'))) {
    return {
      studyType: 'case-control',
      confidence: 'high',
      equatorGuideline: 'STROBE',
      reasoning: 'Keywords in methods: case-control study',
      keywords: ['case-control', 'STROBE'],
    };
  }

  // PRIORITY 3: Systematic review / Meta-analysis (check AFTER observational to avoid citation false positives)
  // IMPROVED: Require multiple confirming keywords in methods section
  const hasSystematicReview = methodsSection.includes('systematic review') || methodsSection.includes('systematic literature');
  const hasMetaAnalysis = methodsSection.includes('meta-analysis') || methodsSection.includes('meta analysis');
  const hasSearchStrategy = methodsSection.includes('search strategy') || methodsSection.includes('databases searched');
  const hasPooledAnalysis = methodsSection.includes('pooled') || methodsSection.includes('combined estimate');

  if ((hasSystematicReview || hasMetaAnalysis) && (hasSearchStrategy || hasPooledAnalysis)) {
    const isMeta = hasMetaAnalysis || hasPooledAnalysis;
    return {
      studyType: isMeta ? 'meta-analysis' : 'systematic-review',
      confidence: 'high',
      equatorGuideline: 'PRISMA',
      reasoning: `Keywords in methods: ${isMeta ? 'meta-analysis + pooled analysis' : 'systematic review + search strategy'}`,
      keywords: [isMeta ? 'meta-analysis' : 'systematic review', 'PRISMA', 'search strategy'],
    };
  }

  // Diagnostic accuracy study
  if ((text.includes('diagnostic') && text.includes('accuracy')) || 
      (text.includes('sensitivity') && text.includes('specificity'))) {
    return {
      studyType: 'diagnostic',
      confidence: 'high',
      equatorGuideline: 'STARD',
      reasoning: 'Keywords: diagnostic accuracy/sensitivity/specificity',
      keywords: ['diagnostic accuracy', 'STARD'],
    };
  }

  // Case report
  if ((text.includes('case report') || text.includes('case series')) && !text.includes('case-control')) {
    return {
      studyType: 'case-report',
      confidence: 'high',
      equatorGuideline: 'CARE',
      reasoning: 'Keywords: case report/series',
      keywords: ['case report', 'CARE'],
    };
  }

  return null; // No clear match
}

/**
 * AI-powered study type detection (Tier 2 - When keywords fail)
 */
export async function aiDetectStudyType(paperText: string): Promise<StudyTypeResult> {
  const prompt = `Analyze this research paper and identify the study design.

Paper excerpt (first 3000 chars):
${paperText.substring(0, 3000)}

Identify the study type and respond in JSON format:
{
  "studyType": "rct|cohort|case-control|cross-sectional|systematic-review|meta-analysis|diagnostic|prognostic|case-report|qualitative|animal-study|economic-evaluation|quality-improvement|other",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of why this is the study type",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Study type definitions:
- rct: Randomized controlled trial with random allocation
- cohort: Follow-up study tracking outcomes over time
- case-control: Retrospective comparison of cases vs controls
- cross-sectional: Snapshot study at single time point
- systematic-review: Comprehensive literature synthesis
- meta-analysis: Quantitative synthesis with pooled analysis
- diagnostic: Evaluates diagnostic test accuracy
- prognostic: Predicts future outcomes
- case-report: Description of 1 or few patients
- qualitative: Interviews, focus groups, thematic analysis
- animal-study: Pre-clinical research on animals
- economic-evaluation: Cost-effectiveness analysis
- quality-improvement: QI project evaluation
- other: Doesn't fit standard categories`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0]?.message?.content || '{}');
  const studyType = result.studyType as StudyType;
  
  return {
    studyType: studyType || 'other',
    confidence: result.confidence || 'low',
    equatorGuideline: EQUATOR_MAPPING[studyType] || 'NONE',
    reasoning: result.reasoning || 'AI analysis',
    keywords: result.keywords || [],
  };
}

/**
 * Main detection function - HYBRID APPROACH
 * 1. Run keyword detection (fast, contextual)
 * 2. Run AI detection (accurate, comprehensive)
 * 3. Compare:
 *    - If they agree → use (high confidence)
 *    - If they disagree → trust AI (AI is arbiter)
 */
export async function detectStudyType(paperText: string): Promise<StudyTypeResult> {
  console.log('[Study Type Detector] Starting hybrid detection...');

  // STEP 1: Run keyword detection
  const keywordResult = quickDetectStudyType(paperText);

  if (keywordResult) {
    console.log(`[Study Type Detector] 📝 Keyword detection: ${keywordResult.studyType} (${keywordResult.equatorGuideline})`);
  } else {
    console.log('[Study Type Detector] 📝 Keyword detection: No clear match');
  }

  // STEP 2: Always run AI detection for validation
  console.log('[Study Type Detector] 🤖 Running AI validation...');
  const aiResult = await aiDetectStudyType(paperText);
  console.log(`[Study Type Detector] 🤖 AI detection: ${aiResult.studyType} (${aiResult.equatorGuideline})`);

  // STEP 3: Compare and decide
  if (!keywordResult) {
    // No keyword match, trust AI
    console.log('[Study Type Detector] ✅ Using AI result (no keyword match)');
    return {
      ...aiResult,
      confidence: aiResult.confidence,
      reasoning: `AI detection: ${aiResult.reasoning}`,
    };
  }

  if (keywordResult.studyType === aiResult.studyType) {
    // Agreement! High confidence
    console.log(`[Study Type Detector] ✅ AGREEMENT: Both detected "${keywordResult.studyType}" → ${keywordResult.equatorGuideline}`);
    return {
      ...keywordResult,
      confidence: 'high',
      reasoning: `Keyword + AI agreement: ${keywordResult.reasoning}`,
    };
  }

  // Disagreement: Trust AI (it's the arbiter)
  console.log(`[Study Type Detector] ⚠️ DISAGREEMENT: Keywords="${keywordResult.studyType}" vs AI="${aiResult.studyType}"`);
  console.log(`[Study Type Detector] ✅ Trusting AI: ${aiResult.studyType} → ${aiResult.equatorGuideline}`);

  return {
    ...aiResult,
    confidence: 'high', // High confidence in AI when it corrects keywords
    reasoning: `AI override (was: ${keywordResult.studyType}): ${aiResult.reasoning}`,
  };
}
