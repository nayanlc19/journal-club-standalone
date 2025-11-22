/**
 * CASP (Critical Appraisal Skills Programme) Checklists
 * 2024 versions - Student-friendly quick appraisal
 */

import Groq from 'groq-sdk';
import { StudyType } from './study-type-detector';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export type CASPAnswer = 'yes' | 'no' | 'cant-tell';

export interface CASPQuestion {
  id: string;
  question: string;
  prompt: string; // Why this matters
  answer?: CASPAnswer;
  evidence?: string; // Quote from paper
}

export interface CASPResult {
  checklist: 'RCT' | 'Cohort' | 'Case-Control' | 'Systematic-Review' | 'Qualitative' | 'Diagnostic' | 'Other';
  questions: CASPQuestion[];
  yesCount: number;
  noCount: number;
  cantTellCount: number;
  totalQuestions: number;
  score: number; // Percentage
  interpretation: string;
}

/**
 * CASP RCT Checklist (2024) - 12 Questions
 */
const CASP_RCT_QUESTIONS: CASPQuestion[] = [
  {
    id: 'rct_1',
    question: 'Did the trial address a clearly focused issue?',
    prompt: 'A clear research question ensures results are interpretable and applicable. Should define population, intervention, comparator, and outcomes (PICO).',
  },
  {
    id: 'rct_2',
    question: 'Was the assignment of patients to treatments randomised?',
    prompt: 'Randomization prevents selection bias by ensuring groups are comparable at baseline.',
  },
  {
    id: 'rct_3',
    question: 'Were all patients who entered the trial properly accounted for at its conclusion?',
    prompt: 'Complete follow-up data prevents attrition bias. Should track all participants and explain any dropouts.',
  },
  {
    id: 'rct_4',
    question: 'Were patients, health workers and study personnel "blind" to treatment?',
    prompt: 'Blinding prevents performance and detection bias. Double-blinding (patients + staff) is ideal for subjective outcomes.',
  },
  {
    id: 'rct_5',
    question: 'Were the groups similar at the start of the trial?',
    prompt: 'Baseline comparability ensures observed differences are due to intervention, not confounding factors.',
  },
  {
    id: 'rct_6',
    question: 'Aside from the experimental intervention, were the groups treated equally?',
    prompt: 'Co-interventions can confound results. Groups should receive identical care except for the intervention being tested.',
  },
  {
    id: 'rct_7',
    question: 'How large was the treatment effect?',
    prompt: 'Effect size determines clinical significance. Look for relative risk, hazard ratio, or mean difference with confidence intervals.',
  },
  {
    id: 'rct_8',
    question: 'How precise was the estimate of the treatment effect?',
    prompt: 'Narrow confidence intervals indicate precise estimates. Wide CIs suggest uncertainty about true effect size.',
  },
  {
    id: 'rct_9',
    question: 'Can the results be applied to the local population?',
    prompt: 'Generalizability depends on how similar your patients are to study participants. Consider inclusion/exclusion criteria.',
  },
  {
    id: 'rct_10',
    question: 'Were all clinically important outcomes considered?',
    prompt: 'Should include patient-important outcomes (mortality, quality of life), not just surrogate markers.',
  },
  {
    id: 'rct_11',
    question: 'Are the benefits worth the harms and costs?',
    prompt: 'Clinical decision-making requires weighing benefits against adverse effects and resource requirements.',
  },
  {
    id: 'rct_12',
    question: 'Was the trial stopped early for benefit?',
    prompt: 'Early stopping can overestimate treatment effects and reduce confidence in findings.',
  },
];

/**
 * CASP Cohort Study Checklist (2024) - 12 Questions
 */
const CASP_COHORT_QUESTIONS: CASPQuestion[] = [
  {
    id: 'cohort_1',
    question: 'Did the study address a clearly focused issue?',
    prompt: 'Should clearly define the population, exposure, and outcome of interest.',
  },
  {
    id: 'cohort_2',
    question: 'Was the cohort recruited in an acceptable way?',
    prompt: 'Recruitment method affects generalizability. Look for representative sampling and clear inclusion criteria.',
  },
  {
    id: 'cohort_3',
    question: 'Was the exposure accurately measured to minimize bias?',
    prompt: 'Exposure measurement must be valid, reliable, and ideally blinded to outcome.',
  },
  {
    id: 'cohort_4',
    question: 'Was the outcome accurately measured to minimize bias?',
    prompt: 'Outcome assessors should be blinded to exposure status when possible.',
  },
  {
    id: 'cohort_5',
    question: 'Have the authors identified all important confounding factors?',
    prompt: 'Confounders are factors associated with both exposure and outcome. Should be measured and controlled.',
  },
  {
    id: 'cohort_6',
    question: 'Have they taken account of the confounding factors in the design and/or analysis?',
    prompt: 'Look for matching, stratification, or multivariable regression to control confounding.',
  },
  {
    id: 'cohort_7',
    question: 'Was the follow-up of subjects complete enough?',
    prompt: 'Lost to follow-up can introduce bias. Generally, <20% loss is acceptable.',
  },
  {
    id: 'cohort_8',
    question: 'Was the follow-up of subjects long enough?',
    prompt: 'Follow-up duration must be sufficient for outcomes to occur.',
  },
  {
    id: 'cohort_9',
    question: 'What are the results of this study?',
    prompt: 'Look for effect estimates (hazard ratio, relative risk) with confidence intervals and p-values.',
  },
  {
    id: 'cohort_10',
    question: 'How precise are the results?',
    prompt: 'Narrow confidence intervals indicate more precise estimates of effect.',
  },
  {
    id: 'cohort_11',
    question: 'Do you believe the results?',
    prompt: 'Consider overall quality, potential biases, and biological plausibility.',
  },
  {
    id: 'cohort_12',
    question: 'Can the results be applied to the local population?',
    prompt: 'Consider similarity of study population to your patients.',
  },
];

/**
 * CASP Systematic Review Checklist (2024) - 11 Questions
 */
const CASP_SR_QUESTIONS: CASPQuestion[] = [
  {
    id: 'sr_1',
    question: 'Did the review address a clearly focused question?',
    prompt: 'Should define PICO: Population, Intervention, Comparator, Outcomes.',
  },
  {
    id: 'sr_2',
    question: 'Did the authors look for the appropriate sort of papers?',
    prompt: 'Study designs should match the research question (e.g., RCTs for interventions).',
  },
  {
    id: 'sr_3',
    question: 'Do you think all the important, relevant studies were included?',
    prompt: 'Comprehensive search of multiple databases, grey literature, and reference lists.',
  },
  {
    id: 'sr_4',
    question: 'Did the review authors do enough to assess the quality of the included studies?',
    prompt: 'Should use validated tools (e.g., Cochrane RoB, ROBINS-I) to assess risk of bias.',
  },
  {
    id: 'sr_5',
    question: 'If the results have been combined, was it reasonable to do so?',
    prompt: 'Meta-analysis is only appropriate when studies are sufficiently similar (homogeneous).',
  },
  {
    id: 'sr_6',
    question: 'What are the overall results of the review?',
    prompt: 'Look for summary effect estimates, forest plots, and heterogeneity (I²) statistics.',
  },
  {
    id: 'sr_7',
    question: 'How precise are the results?',
    prompt: 'Confidence intervals around pooled estimates indicate precision.',
  },
  {
    id: 'sr_8',
    question: 'Can the results be applied to the local population?',
    prompt: 'Consider if included studies represent your patient population.',
  },
  {
    id: 'sr_9',
    question: 'Were all important outcomes considered?',
    prompt: 'Should include patient-important outcomes, not just surrogate markers.',
  },
  {
    id: 'sr_10',
    question: 'Are the benefits worth the harms and costs?',
    prompt: 'Clinical utility requires favorable benefit-risk ratio.',
  },
  {
    id: 'sr_11',
    question: 'Was the review registered or protocol published?',
    prompt: 'Pre-registration (PROSPERO) prevents selective reporting and outcome switching.',
  },
];

/**
 * Get appropriate CASP checklist based on study type
 */
function getCASPChecklist(studyType: StudyType): CASPQuestion[] {
  switch (studyType) {
    case 'rct':
      return CASP_RCT_QUESTIONS;
    case 'cohort':
    case 'cross-sectional':
      return CASP_COHORT_QUESTIONS;
    case 'systematic-review':
    case 'meta-analysis':
      return CASP_SR_QUESTIONS;
    default:
      return CASP_RCT_QUESTIONS; // Default fallback
  }
}

/**
 * Main CASP assessment function using AI
 */
export async function performCASPAssessment(
  paperText: string,
  studyType: StudyType
): Promise<CASPResult> {
  console.log(`[CASP] Starting assessment for ${studyType}...`);
  
  const questions = getCASPChecklist(studyType);
  const checklistName = getChecklistName(studyType);
  
  const prompt = `You are a critical appraisal expert. Evaluate this research paper using the CASP ${checklistName} checklist.

Paper content:
${paperText.substring(0, 8000)}

Answer each question with:
- Answer: "yes" | "no" | "cant-tell"
- Evidence: Brief quote or statement from paper supporting your answer

Respond in JSON format:
{
  "assessments": [
    {
      "id": "question_id",
      "answer": "yes|no|cant-tell",
      "evidence": "Quote or explanation"
    }
  ]
}

Questions to answer:
${questions.map(q => `${q.id}: ${q.question}`).join('\n')}`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  });

  const aiResult = JSON.parse(response.choices[0]?.message?.content || '{}');
  const assessments = aiResult.assessments || [];

  // Map AI results to questions
  const answeredQuestions = questions.map(q => {
    const aiAnswer = assessments.find((a: any) => a.id === q.id);
    return {
      ...q,
      answer: (aiAnswer?.answer || 'cant-tell') as CASPAnswer,
      evidence: aiAnswer?.evidence || 'Not found in paper',
    };
  });

  // Calculate scores
  const yesCount = answeredQuestions.filter(q => q.answer === 'yes').length;
  const noCount = answeredQuestions.filter(q => q.answer === 'no').length;
  const cantTellCount = answeredQuestions.filter(q => q.answer === 'cant-tell').length;
  const totalQuestions = questions.length;
  const score = Math.round((yesCount / totalQuestions) * 100);

  // Interpretation
  let interpretation = '';
  if (score >= 90) interpretation = 'Excellent quality - Very low risk of bias';
  else if (score >= 75) interpretation = 'Good quality - Low risk of bias';
  else if (score >= 60) interpretation = 'Moderate quality - Some concerns';
  else if (score >= 40) interpretation = 'Fair quality - Significant concerns';
  else interpretation = 'Poor quality - High risk of bias';

  console.log(`[CASP] ✅ Assessment complete: ${yesCount}/${totalQuestions} (${score}%)`);

  return {
    checklist: checklistName,
    questions: answeredQuestions,
    yesCount,
    noCount,
    cantTellCount,
    totalQuestions,
    score,
    interpretation,
  };
}

function getChecklistName(studyType: StudyType): CASPResult['checklist'] {
  switch (studyType) {
    case 'rct': return 'RCT';
    case 'cohort': return 'Cohort';
    case 'case-control': return 'Case-Control';
    case 'systematic-review':
    case 'meta-analysis': return 'Systematic-Review';
    case 'qualitative': return 'Qualitative';
    case 'diagnostic': return 'Diagnostic';
    default: return 'Other';
  }
}
