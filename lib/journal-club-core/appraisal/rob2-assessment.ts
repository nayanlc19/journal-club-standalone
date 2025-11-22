/**
 * Cochrane Risk of Bias 2 (RoB 2) Assessment Tool
 * For randomized controlled trials
 */

import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export type RoBJudgment = 'low' | 'some-concerns' | 'high';

export interface RoBDomain {
  domain: string;
  domainNumber: number;
  judgment: RoBJudgment;
  rationale: string;
  signalingQuestions: Array<{
    question: string;
    answer: 'yes' | 'probably-yes' | 'probably-no' | 'no' | 'no-info';
  }>;
}

export interface RoB2Result {
  overallJudgment: RoBJudgment;
  domains: RoBDomain[];
  summary: string;
  trafficLightChart: string; // Emoji visualization
}

/**
 * RoB 2 Domain Definitions (5 domains for RCTs)
 */
const ROB2_DOMAINS = [
  {
    domainNumber: 1,
    domain: 'Randomization process',
    description: 'Bias arising from the randomization process',
    keyQuestions: [
      'Was the allocation sequence random?',
      'Was the allocation sequence concealed until participants were enrolled?',
      'Were baseline differences between groups suggestive of a problem with randomization?',
    ],
  },
  {
    domainNumber: 2,
    domain: 'Deviations from intended interventions',
    description: 'Bias due to deviations from the intended interventions',
    keyQuestions: [
      'Were participants aware of their assigned intervention?',
      'Were carers and trial personnel aware of intervention assignments?',
      'Were there deviations from the intended intervention?',
      'Was an appropriate analysis used to estimate the effect of assignment?',
    ],
  },
  {
    domainNumber: 3,
    domain: 'Missing outcome data',
    description: 'Bias due to missing outcome data',
    keyQuestions: [
      'Were data available for all, or nearly all, participants?',
      'Is there evidence that the result was not biased by missing data?',
      'Could missingness depend on the true value of the outcome?',
    ],
  },
  {
    domainNumber: 4,
    domain: 'Measurement of the outcome',
    description: 'Bias in measurement of the outcome',
    keyQuestions: [
      'Was the method of measuring the outcome inappropriate?',
      'Could measurement or ascertainment of the outcome differ between groups?',
      'Were outcome assessors aware of the intervention received?',
    ],
  },
  {
    domainNumber: 5,
    domain: 'Selection of the reported result',
    description: 'Bias in selection of the reported result',
    keyQuestions: [
      'Was the trial analyzed in accordance with a pre-specified plan?',
      'Were the numerical result being assessed likely to have been selected on the basis of results?',
    ],
  },
];

/**
 * Perform RoB 2 assessment using AI
 */
export async function performRoB2Assessment(paperText: string): Promise<RoB2Result> {
  console.log('[RoB 2] Starting Cochrane Risk of Bias assessment...');
  
  const prompt = `You are a Cochrane systematic review expert. Assess the risk of bias in this RCT using the RoB 2 tool.

Paper content:
${paperText.substring(0, 10000)}

Evaluate each of the 5 domains and provide:
1. Judgment: "low" | "some-concerns" | "high"
2. Rationale: Brief explanation (2-3 sentences) with evidence from paper

Respond in JSON format:
{
  "domains": [
    {
      "domainNumber": 1,
      "judgment": "low|some-concerns|high",
      "rationale": "Explanation with evidence"
    },
    {
      "domainNumber": 2,
      "judgment": "low|some-concerns|high",
      "rationale": "Explanation"
    }
    // ... for all 5 domains
  ]
}

The 5 domains are:
1. Randomization process
2. Deviations from intended interventions
3. Missing outcome data
4. Measurement of the outcome
5. Selection of the reported result

Judgment criteria:
- LOW: No concerns or trivial concerns
- SOME CONCERNS: Raises some doubts about results
- HIGH: Serious concerns that weaken confidence in results`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const aiResult = JSON.parse(response.choices[0]?.message?.content || '{}');
  const domainAssessments = aiResult.domains || [];

  // Build domain results
  const domains: RoBDomain[] = ROB2_DOMAINS.map(domainDef => {
    const aiDomain = domainAssessments.find((d: any) => d.domainNumber === domainDef.domainNumber);
    return {
      domain: domainDef.domain,
      domainNumber: domainDef.domainNumber,
      judgment: (aiDomain?.judgment || 'some-concerns') as RoBJudgment,
      rationale: aiDomain?.rationale || 'Not assessed',
      signalingQuestions: [], // Simplified for now
    };
  });

  // Overall judgment (worst case among domains)
  const hasHigh = domains.some(d => d.judgment === 'high');
  const hasConcerns = domains.some(d => d.judgment === 'some-concerns');
  const overallJudgment: RoBJudgment = hasHigh ? 'high' : hasConcerns ? 'some-concerns' : 'low';

  // Generate traffic light chart
  const trafficLightChart = generateTrafficLightChart(domains, overallJudgment);

  // Summary
  const summary = `Overall Risk of Bias: ${overallJudgment.toUpperCase().replace('-', ' ')}. ` +
    `${domains.filter(d => d.judgment === 'high').length} high risk, ` +
    `${domains.filter(d => d.judgment === 'some-concerns').length} some concerns, ` +
    `${domains.filter(d => d.judgment === 'low').length} low risk domains.`;

  console.log(`[RoB 2] ✅ Assessment complete: Overall = ${overallJudgment}`);

  return {
    overallJudgment,
    domains,
    summary,
    trafficLightChart,
  };
}

/**
 * Generate traffic light chart visualization
 */
function generateTrafficLightChart(domains: RoBDomain[], overall: RoBJudgment): string {
  const getEmoji = (judgment: RoBJudgment) => {
    switch (judgment) {
      case 'low': return '🟢';
      case 'some-concerns': return '🟡';
      case 'high': return '🔴';
    }
  };

  let chart = '| Domain | Judgment | Rationale |\n';
  chart += '|--------|----------|------------|\n';
  
  domains.forEach(d => {
    chart += `| ${d.domainNumber}. ${d.domain} | ${getEmoji(d.judgment)} ${d.judgment.toUpperCase().replace('-', ' ')} | ${d.rationale} |\n`;
  });
  
  chart += `| **Overall Risk of Bias** | **${getEmoji(overall)} ${overall.toUpperCase().replace('-', ' ')}** | Based on all domains |\n`;
  
  return chart;
}
