/**
 * EQUATOR Network Reporting Guidelines Compliance Checker
 * Supports: CONSORT, PRISMA, STROBE, STARD, TRIPOD, CARE, etc.
 */

import Groq from 'groq-sdk';
import { StudyType, EquatorGuideline } from './study-type-detector';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export interface EquatorItem {
  itemNumber: string;
  section: string;
  item: string;
  reported: 'yes' | 'no' | 'partial' | 'na';
  pageNumber?: string;
  evidence?: string;
}

export interface EquatorResult {
  guideline: EquatorGuideline;
  guidelineVersion: string;
  totalItems: number;
  reportedItems: number;
  partialItems: number;
  notReportedItems: number;
  compliancePercentage: number;
  items: EquatorItem[];
  interpretation: string;
}

/**
 * CONSORT 2010 Checklist (25 items for RCTs)
 * Simplified version with key items
 */
const CONSORT_ITEMS = [
  { itemNumber: '1a', section: 'Title', item: 'Identification as a randomised trial in the title' },
  { itemNumber: '1b', section: 'Abstract', item: 'Structured summary including trial design, methods, results, and conclusions' },
  { itemNumber: '2a', section: 'Background', item: 'Scientific background and explanation of rationale' },
  { itemNumber: '2b', section: 'Objectives', item: 'Specific objectives or hypotheses' },
  { itemNumber: '3a', section: 'Trial design', item: 'Description of trial design (parallel, factorial) including allocation ratio' },
  { itemNumber: '4a', section: 'Participants', item: 'Eligibility criteria for participants' },
  { itemNumber: '5', section: 'Interventions', item: 'Details of interventions for each group with sufficient detail to allow replication' },
  { itemNumber: '6a', section: 'Outcomes', item: 'Completely defined pre-specified primary and secondary outcome measures' },
  { itemNumber: '7a', section: 'Sample size', item: 'How sample size was determined' },
  { itemNumber: '8a', section: 'Randomization', item: 'Method used to generate the random allocation sequence' },
  { itemNumber: '9', section: 'Allocation concealment', item: 'Mechanism used to implement the random allocation sequence' },
  { itemNumber: '10', section: 'Implementation', item: 'Who generated sequence, who enrolled participants, who assigned interventions' },
  { itemNumber: '11a', section: 'Blinding', item: 'If done, who was blinded after assignment and how' },
  { itemNumber: '12a', section: 'Statistical methods', item: 'Statistical methods used to compare groups for primary and secondary outcomes' },
  { itemNumber: '13a', section: 'Participant flow', item: 'Numbers of participants randomly assigned, receiving intervention, and analyzed' },
  { itemNumber: '14a', section: 'Recruitment', item: 'Dates defining periods of recruitment and follow-up' },
  { itemNumber: '15', section: 'Baseline data', item: 'Baseline demographic and clinical characteristics for each group' },
  { itemNumber: '16', section: 'Numbers analyzed', item: 'Number of participants in each group included in analysis' },
  { itemNumber: '17a', section: 'Outcomes', item: 'For primary and secondary outcomes, results with effect size and precision' },
  { itemNumber: '18', section: 'Ancillary analyses', item: 'Results of any other analyses performed' },
  { itemNumber: '19', section: 'Harms', item: 'All important harms or unintended effects in each group' },
  { itemNumber: '20', section: 'Limitations', item: 'Trial limitations, addressing sources of bias, imprecision' },
  { itemNumber: '21', section: 'Generalisability', item: 'Generalisability (external validity) of trial findings' },
  { itemNumber: '22', section: 'Interpretation', item: 'Interpretation consistent with results, balancing benefits and harms' },
  { itemNumber: '23', section: 'Registration', item: 'Registration number and name of trial registry' },
  { itemNumber: '24', section: 'Protocol', item: 'Where the full trial protocol can be accessed' },
  { itemNumber: '25', section: 'Funding', item: 'Sources of funding and other support' },
];

/**
 * PRISMA 2020 Checklist (27 items for Systematic Reviews)
 * Key items only
 */
const PRISMA_ITEMS = [
  { itemNumber: '1', section: 'Title', item: 'Identify the report as a systematic review' },
  { itemNumber: '2', section: 'Abstract', item: 'Structured summary including objectives, eligibility, sources, methods, results' },
  { itemNumber: '3', section: 'Rationale', item: 'Rationale for the review in context of existing knowledge' },
  { itemNumber: '4', section: 'Objectives', item: 'Explicit objectives or questions with PICO elements' },
  { itemNumber: '5', section: 'Eligibility criteria', item: 'Inclusion and exclusion criteria' },
  { itemNumber: '6', section: 'Information sources', item: 'All databases, registers, websites searched with dates' },
  { itemNumber: '7', section: 'Search strategy', item: 'Full search strategies for at least one database' },
  { itemNumber: '8', section: 'Selection process', item: 'How many reviewers screened each record and resolved disagreements' },
  { itemNumber: '9', section: 'Data collection', item: 'Methods for extracting data from reports' },
  { itemNumber: '10a', section: 'Risk of bias', item: 'Methods used to assess risk of bias' },
  { itemNumber: '12', section: 'Synthesis methods', item: 'Methods to combine/present results' },
  { itemNumber: '16', section: 'Study selection', item: 'PRISMA flow diagram showing study selection process' },
  { itemNumber: '17', section: 'Study characteristics', item: 'Characteristics of included studies' },
  { itemNumber: '18', section: 'Risk of bias', item: 'Assessment of risk of bias for each study' },
  { itemNumber: '19', section: 'Results', item: 'Results of syntheses with summary statistics and forest plots' },
  { itemNumber: '23', section: 'Limitations', item: 'Limitations at study and review level' },
  { itemNumber: '24', section: 'Registration', item: 'Protocol registration number and where it can be accessed' },
  { itemNumber: '27', section: 'Funding', item: 'Sources of funding and support' },
];

/**
 * STROBE Checklist (22 items for Observational Studies)
 * Key items only
 */
const STROBE_ITEMS = [
  { itemNumber: '1', section: 'Title', item: 'Indicate study design in title or abstract' },
  { itemNumber: '2', section: 'Abstract', item: 'Structured summary of background, methods, results, conclusions' },
  { itemNumber: '3', section: 'Background', item: 'Scientific background and rationale' },
  { itemNumber: '4', section: 'Objectives', item: 'State specific objectives including pre-specified hypotheses' },
  { itemNumber: '5', section: 'Study design', item: 'Present key elements of study design early in paper' },
  { itemNumber: '6', section: 'Setting', item: 'Describe setting, locations, dates of data collection' },
  { itemNumber: '7', section: 'Participants', item: 'Eligibility criteria and sources of participants' },
  { itemNumber: '8', section: 'Variables', item: 'Clearly define all outcomes, exposures, predictors, confounders' },
  { itemNumber: '9', section: 'Data sources', item: 'For each variable, give sources and methods of assessment' },
  { itemNumber: '10', section: 'Bias', item: 'Describe efforts to address potential sources of bias' },
  { itemNumber: '11', section: 'Study size', item: 'Explain how study size was arrived at' },
  { itemNumber: '12', section: 'Statistical methods', item: 'Describe statistical methods including those to control confounding' },
  { itemNumber: '13', section: 'Participants', item: 'Numbers at each stage (eligible, included, followed, analyzed)' },
  { itemNumber: '14', section: 'Descriptive data', item: 'Characteristics of participants and exposures' },
  { itemNumber: '15', section: 'Outcome data', item: 'Report numbers of outcome events or summary measures' },
  { itemNumber: '16', section: 'Main results', item: 'Unadjusted and adjusted estimates with precision (95% CI)' },
  { itemNumber: '18', section: 'Key results', item: 'Summarise key results with reference to objectives' },
  { itemNumber: '19', section: 'Limitations', item: 'Discuss limitations including sources of bias or imprecision' },
  { itemNumber: '21', section: 'Generalisability', item: 'Discuss generalisability (external validity)' },
  { itemNumber: '22', section: 'Funding', item: 'Sources of funding and role of funders' },
];

/**
 * Get checklist items based on guideline
 */
function getChecklistItems(guideline: EquatorGuideline) {
  switch (guideline) {
    case 'CONSORT': return CONSORT_ITEMS;
    case 'PRISMA': return PRISMA_ITEMS;
    case 'STROBE': return STROBE_ITEMS;
    default: return CONSORT_ITEMS; // Fallback
  }
}

/**
 * Main EQUATOR compliance checker
 */
export async function checkEquatorCompliance(
  paperText: string,
  guideline: EquatorGuideline
): Promise<EquatorResult> {
  console.log(`[EQUATOR] Checking ${guideline} compliance...`);
  
  const checklistItems = getChecklistItems(guideline);
  const guidelineVersion = guideline === 'CONSORT' ? '2010' : 
                          guideline === 'PRISMA' ? '2020' : 
                          guideline === 'STROBE' ? '2007' : '2024';
  
  const prompt = `You are an EQUATOR network expert. Check compliance with the ${guideline} ${guidelineVersion} reporting guideline.

Paper content:
${paperText.substring(0, 12000)}

For each checklist item, determine:
- reported: "yes" | "no" | "partial" | "na"
- evidence: Brief summary or location (if found)

IMPORTANT: For evidence field, use ONLY plain text. NO quotes, commas, or special characters. Paraphrase instead of copying verbatim.

Respond in JSON format:
{
  "items": [
    {
      "itemNumber": "1a",
      "reported": "yes|no|partial|na",
      "evidence": "Plain text summary without quotes or special chars"
    }
  ]
}

Checklist items:
${checklistItems.map(item => `${item.itemNumber}. ${item.section}: ${item.item}`).join('\n')}

Criteria:
- yes: Fully reported
- partial: Mentioned but incomplete
- no: Not reported
- na: Not applicable to this study`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const aiResult = JSON.parse(response.choices[0]?.message?.content || '{}');
  const aiItems = aiResult.items || [];

  // Map AI results to checklist items
  const items: EquatorItem[] = checklistItems.map(checklistItem => {
    const aiItem = aiItems.find((a: any) => a.itemNumber === checklistItem.itemNumber);
    return {
      itemNumber: checklistItem.itemNumber,
      section: checklistItem.section,
      item: checklistItem.item,
      reported: (aiItem?.reported || 'no') as EquatorItem['reported'],
      evidence: aiItem?.evidence || 'Not assessed',
    };
  });

  // Calculate compliance
  const totalItems = items.length;
  const reportedItems = items.filter(i => i.reported === 'yes').length;
  const partialItems = items.filter(i => i.reported === 'partial').length;
  const notReportedItems = items.filter(i => i.reported === 'no').length;
  const compliancePercentage = Math.round(((reportedItems + partialItems * 0.5) / totalItems) * 100);

  // Interpretation
  let interpretation = '';
  if (compliancePercentage >= 90) interpretation = 'Excellent reporting quality';
  else if (compliancePercentage >= 75) interpretation = 'Good reporting quality';
  else if (compliancePercentage >= 60) interpretation = 'Moderate reporting quality';
  else interpretation = 'Poor reporting quality - significant items missing';

  console.log(`[EQUATOR] ✅ ${guideline} compliance: ${reportedItems}/${totalItems} (${compliancePercentage}%)`);

  return {
    guideline,
    guidelineVersion,
    totalItems,
    reportedItems,
    partialItems,
    notReportedItems,
    compliancePercentage,
    items,
    interpretation,
  };
}
