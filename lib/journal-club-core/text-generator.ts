/**
 * Comprehensive Text Generator for Journal Club Presentations
 * Generates student-friendly critical appraisal in Markdown format
 */

import Groq from 'groq-sdk';
import { performComprehensiveAppraisal } from './appraisal/index.js';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export interface PaperContent {
  markdown: string;
  text: string;
  title?: string;
  doi?: string;
}

export interface GeneratedAppraisal {
  clinicalQuestion: string;
  bottomLine: string;
  executiveSummary: string;
  paperBasics: string;
  studyDesign: string;
  historicalContext: string;
  criticalAppraisalChecklist: string;
  methodsDeepDive: string;
  resultsInterpretation: string;
  tablesAndFigures: string;
  criticalAnalysis: string;
  criticisms: string;
  impactAndEvidence: string;
  defenseQuestions: string;
  funding: string;
  relatedResearch: string;
  fullMarkdown: string;
}

/**
 * Generate comprehensive critical appraisal
 */
export async function generateCriticalAppraisal(
  content: PaperContent
): Promise<GeneratedAppraisal> {
  console.log('[Text Generator] Starting comprehensive appraisal generation...');
  console.log('[Text Generator] ⚡ Running all sections in PARALLEL for maximum speed!');

  const startTime = Date.now();

  // Run ALL sections in parallel using Promise.all - HUGE speed boost!
  const [
    clinicalQuestion,
    bottomLine,
    executiveSummary,
    paperBasics,
    studyDesign,
    historicalContext,
    criticalAppraisalChecklist,
    methodsDeepDive,
    researchGlossary,
    resultsInterpretation,
    tablesAndFigures,
    criticalAnalysis,
    criticisms,
    impactAndEvidence,
    defenseQuestions,
    funding,
    relatedResearch,
  ] = await Promise.all([
    generateClinicalQuestion(content),
    generateBottomLine(content),
    generateExecutiveSummary(content),
    generatePaperBasics(content),
    generateStudyDesign(content),
    generateHistoricalContext(content),
    generateCriticalAppraisalChecklist(content),
    generateMethodsDeepDive(content),
    generateResearchGlossary(content),
    generateResultsInterpretation(content),
    generateTablesAndFigures(content),
    generateCriticalAnalysis(content),
    generateCriticisms(content),
    generateImpactAndEvidence(content),
    generateDefenseQuestions(content),
    generateFunding(content),
    generateRelatedResearch(content),
  ]);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Text Generator] ✅ All sections completed in ${duration}s (parallel execution!)`);

  const sections = {
    clinicalQuestion,
    bottomLine,
    executiveSummary,
    paperBasics,
    studyDesign,
    historicalContext,
    criticalAppraisalChecklist,
    methodsDeepDive,
    researchGlossary,
    resultsInterpretation,
    tablesAndFigures,
    criticalAnalysis,
    criticisms,
    impactAndEvidence,
    defenseQuestions,
    funding,
    relatedResearch,
  };
  
  // Combine all sections into full markdown with logical flow
  const fullMarkdown = `# Critical Appraisal: ${content.title || 'Research Article'}

## Paper Basics

${sections.paperBasics}

## Executive Summary

### Clinical Question (PICO)
${sections.clinicalQuestion}

### Key Takeaway
${sections.bottomLine}

### Overview
${sections.executiveSummary}

## Study Design

${sections.studyDesign}

## Historical Context

${sections.historicalContext}

## Methods Deep-Dive (Spoon-Fed Explanations)

${sections.methodsDeepDive}

## Results Interpretation (Simple Language)

${sections.resultsInterpretation}

## Tables and Figures

${sections.tablesAndFigures}

## Critical Appraisal Checklist

${sections.criticalAppraisalChecklist}

## Critical Analysis

${sections.criticalAnalysis}

## Criticisms

${sections.criticisms}

## Impact & Current Evidence

${sections.impactAndEvidence}

## Funding

${sections.funding}

## Related Research

${sections.relatedResearch}

---
*Generated with Journal Club V2 - Medical Article Critical Appraisal Tool*
`;

  return {
    ...sections,
    fullMarkdown,
  };
}

/**
 * Generate executive summary
 */
async function generateExecutiveSummary(content: PaperContent): Promise<string> {
  const prompt = `You are a medical educator. Create executive summary as MARKDOWN TABLE ONLY.

Paper content (first 4000 chars):
${content.markdown.substring(0, 4000)}

Format as markdown table:

Section | Content
--------|--------
What the study was about | [1-2 sentence summary in simple English]
Main findings | [Key results in conversational tone - explain jargon immediately]
Key takeaway (why it matters) | [Clinical implications and importance]

CRITICAL: Output ONLY the markdown table. NO paragraphs.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.7,
    max_tokens: 9000,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate paper basics (PICO framework)
 */
async function generatePaperBasics(content: PaperContent): Promise<string> {
  const prompt = `Analyze this research paper and extract basic information.

${content.markdown.substring(0, 3000)}

Provide in this format:

**Title:** [Full title]
**Authors:** [First author et al.]
**Journal:** [Journal name, Year]
**Study Type:** [RCT/Cohort/Meta-analysis/etc.]
**DOI:** ${content.doi || 'Not provided'}

### PICO Framework
- **Population:** [Who was studied]
- **Intervention:** [What was tested]
- **Comparator:** [What was it compared to]
- **Outcome:** [What was measured]`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 2400,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate historical context (background only, no impact)
 */
async function generateHistoricalContext(content: PaperContent): Promise<string> {
  const prompt = `Analyze this research paper's historical background and context.

${content.markdown.substring(0, 5000)}

Provide analysis covering ONLY the background and context (do NOT discuss impact or current evidence):

### Treatment/Procedure Evolution Timeline

**IMPORTANT:** If this paper discusses a treatment, procedure, drug, or intervention, create a detailed chronological table showing its evolution UP TO the time of this study. Use this EXACT markdown table format:

| Year/Period | Milestone/Development | Significance/Impact |
|-------------|----------------------|---------------------|
| YYYY | [First description, early attempts, pilot studies] | [Why it mattered, what changed] |
| YYYY | [Key trials, FDA approvals, guideline changes] | [Clinical impact, adoption rate] |
| YYYY | [Refinements, new indications, comparative studies] | [How practice evolved] |
| [Study Year] | [This study's place in timeline] | [What gap it aimed to fill] |

Include 6-8 rows covering the history UP TO this study (not after). Be specific with:
- Trial names (e.g., PARTNER, RECOVERY, SPRINT)
- Regulatory milestones (FDA/EMA approvals)
- Guideline updates (ACC/AHA, ESC, etc.)
- Technical innovations
- Paradigm shifts in thinking

If the paper is NOT about a treatment/procedure, write "N/A - This study does not involve a treatment timeline."

### Why This Study Was Conducted

**IMPORTANT:** Use this EXACT markdown table format (NOT ASCII/space-separated format):

| Aspect | Context Leading Up to the Study |
|--------|----------------------------------|
| Unmet Clinical Problem | What problem existed? |
| Scientific Gap | What was unknown or uncertain? |
| Prevailing Belief/Practice | What was standard practice before this? |
| Timeline & Feasibility | Why was this study feasible at this time? |
| Specific Aims | What did the researchers aim to answer? |
| Why It Was Needed | What made this study necessary or timely? |

Focus ONLY on context and background leading up to the study. Do NOT discuss results, impact, or current evidence.

**CRITICAL:** ALL tables must use markdown format with | pipes. NEVER use space-separated ASCII tables.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.6,
    max_tokens: 6000,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate impact and current evidence (after critical analysis)
 */
async function generateImpactAndEvidence(content: PaperContent): Promise<string> {
  const prompt = `Analyze the real-world impact of this research and current evidence.

${content.markdown.substring(0, 5000)}

Provide analysis covering:

### Trial Performance & Outcomes
- Did the trial succeed or fail in meeting its objectives?
- Were there any unexpected findings or surprises?
- How strong was the evidence generated?
- What were the key results and effect sizes?

### Impact on Science & Clinical Practice
- How did this change medical practice or guidelines?
- What level of evidence does it represent (landmark vs incremental)?
- Did it settle a controversy or open new questions?
- Was it practice-changing or confirmatory?
- Which guidelines or recommendations changed because of this?

### Current Evidence (What We Know Now, 2025)
- Has this been replicated or contradicted by later studies?
- Is this still considered valid or has it been superseded?
- What do current guidelines (2024-2025) say about this topic?
- Have there been any paradigm shifts since this publication?
- What's the current state-of-the-art?

Be factual and balanced. Distinguish between the study's findings and their long-term impact.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.6,
    max_tokens: 6000,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate comprehensive 3-tier critical appraisal checklist
 * Uses CASP, RoB 2 (for RCTs), and EQUATOR guidelines
 */
async function generateCriticalAppraisalChecklist(content: PaperContent): Promise<string> {
  console.log('[Critical Appraisal] Running comprehensive 3-tier assessment...');
  
  // Run comprehensive appraisal
  const appraisal = await performComprehensiveAppraisal(content.markdown);
  
  // Format Tier 1: CASP Quick Appraisal AS MARKDOWN TABLE
  let output = `### Tier 1: Quick Appraisal (CASP ${appraisal.tier1_CASP.checklist} Checklist)\n\n`;
  output += `**Study Type:** ${appraisal.studyType.studyType.toUpperCase()} (${appraisal.studyType.confidence} confidence)\n`;
  output += `**Guideline:** ${appraisal.studyType.equatorGuideline} - ${appraisal.studyType.reasoning}\n\n`;

  // Create markdown table for CASP questions
  output += `| Question | Answer | Evidence | Why It Matters |\n`;
  output += `|----------|--------|----------|----------------|\n`;

  appraisal.tier1_CASP.questions.forEach(q => {
    const answer = q.answer || 'cant-tell';
    const emoji = answer === 'yes' ? '✅' : answer === 'no' ? '❌' : '⚠️';
    const answerText = `${emoji} ${answer.toUpperCase().replace('-', ' ')}`;
    const evidence = (q.evidence || 'Not assessed').replace(/\|/g, ','); // Escape pipes
    const why = q.prompt.replace(/\|/g, ','); // Escape pipes
    output += `| ${q.question} | ${answerText} | ${evidence} | ${why} |\n`;
  });

  output += `\n**Overall CASP Score:** ${appraisal.tier1_CASP.yesCount}/${appraisal.tier1_CASP.totalQuestions} (${appraisal.tier1_CASP.score}%)\n`;
  output += `**Interpretation:** ${appraisal.tier1_CASP.interpretation}\n\n`;
  output += `---\n\n`;
  
  // Format Tier 2: RoB 2 (for RCTs only)
  if (appraisal.tier2_RoB2) {
    output += `### Tier 2: Risk of Bias Assessment (Cochrane RoB 2)\n\n`;
    output += `${appraisal.tier2_RoB2.summary}\n\n`;
    output += appraisal.tier2_RoB2.trafficLightChart;
    output += `\n\n---\n\n`;
  } else {
    // Explain why Tier 2 is skipped for non-RCT studies
    output += `### Tier 2: Risk of Bias Assessment (Not Applicable)\n\n`;
    output += `**Note:** Tier 2 (Cochrane Risk of Bias - RoB 2) is specifically designed for randomized controlled trials (RCTs) and assesses bias domains such as:\n`;
    output += `- Randomization process and allocation concealment\n`;
    output += `- Deviations from intended interventions\n`;
    output += `- Blinding of participants and personnel\n`;
    output += `- Missing outcome data\n`;
    output += `- Selective outcome reporting\n\n`;
    output += `**This study is ${appraisal.studyType.studyType.toUpperCase()}, not an RCT.** Therefore, Tier 2 assessment is not applicable. `;
    output += `Observational studies use different bias assessment tools (covered in Tier 1 CASP checklist).\n\n`;
    output += `---\n\n`;
  }
  
  // Format Tier 3: EQUATOR Compliance AS MARKDOWN TABLE
  output += `### Tier 3: Full EQUATOR Compliance (${appraisal.tier3_EQUATOR.guideline} ${appraisal.tier3_EQUATOR.guidelineVersion})\n\n`;
  output += `**Compliance:** ${appraisal.tier3_EQUATOR.reportedItems}/${appraisal.tier3_EQUATOR.totalItems} fully reported `;
  output += `+ ${appraisal.tier3_EQUATOR.partialItems} partial = **${appraisal.tier3_EQUATOR.compliancePercentage}%**\n`;
  output += `**Interpretation:** ${appraisal.tier3_EQUATOR.interpretation}\n\n`;

  // Create ONE markdown table with all items (no section grouping)
  output += `| Item # | Requirement | Status | Evidence |\n`;
  output += `|--------|------------|--------|----------|\n`;

  appraisal.tier3_EQUATOR.items.forEach(item => {
    const symbol = item.reported === 'yes' ? 'YES' :
                   item.reported === 'partial' ? 'PARTIAL' :
                   item.reported === 'na' ? 'N/A' : 'NO';
    const itemText = item.item.replace(/\|/g, ','); // Escape pipes
    const evidence = (item.evidence || 'Fully reported').replace(/\|/g, ','); // Escape pipes
    output += `| ${item.itemNumber} | ${itemText} | ${symbol} | ${evidence} |\n`;
  });
  output += `\n`;
  
  return output;
}

/**
 * Generate methods deep-dive - TEACH the concepts, don't just summarize
 */
async function generateMethodsDeepDive(content: PaperContent): Promise<string> {
  const prompt = `You are a 140 IQ professor teaching 90 IQ medical students. TEACH methodology and biostatistics as MARKDOWN TABLES ONLY.

${content.markdown.substring(0, 5000)}

CRITICAL: ALL output must be PIPED MARKDOWN TABLES (Aspect | Explanation format). NO paragraphs or bullet points.

## 📊 Study Design

Aspect | Explanation
-------|-------------
Type | [Cohort/RCT/etc]
What This Means | Teach like explaining to confused student - WHY this design? Strengths? Weaknesses?
Goal | What question were they trying to answer
Analogy | Real-world comparison that makes it click

## 👥 Population & Sample

Aspect | Details
-------|--------
Source | Where participants came from
Inclusion | Who was eligible
Final N | How many people
Follow-up | How long

## Sample Size Concepts (Teaching Table)

Concept | Plain English Explanation with Analogy
--------|---------------------------------------
Alpha α | False alarm rate. If α equals 0.05 means 5% chance of crying wolf - finding difference that doesnt exist. Analogy: [your analogy]
Beta β | Missed opportunity rate. If β equals 0.20 (power 80%) means 20% chance of missing real effect. Analogy: [your analogy]
Effect Size | How BIG a difference matters clinically? Tiny difference might be significant but useless
Bottom Line | They needed [N] patients to detect [X]% difference without too many false alarms

## 🧮 Statistical Analysis (TEACH not just list)

Test Method | What It Does Plain English | Why Used Here | Results & Interpretation
------------|---------------------------|---------------|------------------------
[Method 1] | Explain with analogy what this test does | Why this makes sense for their data | What they compared what they found. HR/OR/RR equals [value] means [plain language]. 95% CI [range] means [explain]. p equals [value] means [explain]
[Method 2] | [Explanation] | [Why] | [Results]

## 🔄 Confounders

Aspect | Explanation
-------|-------------
What Are Confounders | Hidden influencers that could mess up results by explaining outcome through different path
What They Adjusted For | [List variables]
Why This Matters | Isolating effect of [exposure] by accounting for other factors

## Key Result Formats

Format | Plain English
-------|---------------
Hazard Ratio HR | Compares risk over time. HR 0.85 means 15% lower hazard - slower arrival of bad events
Odds Ratio OR | Compares odds. OR 0.62 means 38% lower odds - less likely to have outcome
Confidence Interval | Uncertainty range. If 95% CI crosses 1.0 then not statistically significant`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.7,
    max_tokens: 12000,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate results interpretation in simple language
 */
async function generateResultsInterpretation(content: PaperContent): Promise<string> {
  const prompt = `Analyze ALL statistical results using MARKDOWN TABLES for clear presentation.

${content.markdown}

CRITICAL: Format ALL results in MARKDOWN TABLES using pipe (|) format for proper parsing by presentation software.

### Primary Outcomes

| Outcome | Intervention Group | Control Group | Effect Size | 95% CI | P-value | Clinical Interpretation |
|---------|-------------------|---------------|-------------|--------|---------|------------------------|
| [Name] | X% (n/N) | Y% (n/N) | RR: Z | A to B | p=C | [Explain in technical/complex language] |

### Secondary Outcomes

| Outcome | Result | Statistical Significance | Interpretation |
|---------|--------|-------------------------|----------------|
| [Name] | X vs Y | p=Z, 95% CI [A, B] | [Technical explanation] |

### Key Statistical Measures

| Measure | Value | Clinical Meaning |
|---------|-------|------------------|
| Hazard Ratio (HR) | X.XX (95% CI: A-B) | [Technical interpretation for clinicians] |
| Number Needed to Treat (NNT) | XX (95% CI: A-B) | [Technical meaning] |
| Relative Risk (RR) | X.XX (95% CI: A-B) | [Technical interpretation] |

Use complex/technical medical language appropriate for healthcare professionals.
Include all numerical values, confidence intervals, and p-values from the paper.
FORMAT EVERYTHING AS MARKDOWN TABLES - this is mandatory for proper presentation rendering.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.5,
    max_tokens: 9000,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate tables and figures section
 * Note: This returns empty - actual tables/figures are added by vision extraction in orchestrator
 */
async function generateTablesAndFigures(content: PaperContent): Promise<string> {
  return ''; // Vision extraction handles this section
}

/**
 * Generate critical analysis (strengths/weaknesses)
 */
async function generateCriticalAnalysis(content: PaperContent): Promise<string> {
  const prompt = `Critically analyze this study's strengths and weaknesses.

${content.markdown}

Provide:

### Strengths (What They Did Well)
- [3-5 specific strengths with brief explanations]

### Weaknesses (Limitations & Biases)
- [3-5 limitations, explain impact on validity]

### Clinical Implications
- How does this change clinical practice?
- Who should/shouldn't apply these findings?
- What questions remain unanswered?

Be balanced. Acknowledge both merits and flaws.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.6,
    max_tokens: 6000,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate defense questions (48 total: 16 easy, 16 moderate, 16 tough) - Clean Format
 * Post-processes Groq output to create proper single-column banded markdown tables
 */
async function generateDefenseQuestions(content: PaperContent): Promise<string> {
  const prompt = `You are a critical 140 IQ professor grilling 90 IQ medical students at journal club about this paper:

${content.markdown.substring(0, 6000)}

Generate EXACTLY 48 questions (16 simple + 16 moderate + 16 tough) with answers in this EXACT format:

## Simple Intensity (16 questions)

Q: What was the main objective of the study?
A: [2-3 sentence answer from the paper]

Q: What type of study design was employed?
A: [2-3 sentence answer]

Q: Who were the study participants?
A: [2-3 sentence answer]

Q: What was the primary outcome measured?
A: [2-3 sentence answer]

Q: How long was the follow-up period?
A: [2-3 sentence answer]

[Continue with 11 MORE simple questions following this pattern]

## Moderate Intensity (16 questions)

Q: How might selection bias have affected the results?
A: [3-4 sentence answer with critical reasoning]

Q: What are the key limitations of this study's methodology?
A: [3-4 sentence answer]

Q: How generalizable are these findings to other populations?
A: [3-4 sentence answer]

[Continue with 13 MORE moderate questions]

## Tough Intensity (16 questions)

Q: If you were designing this study today, what would you change and why?
A: [4-5 sentence detailed answer with specific improvements]

Q: How do these findings compare to conflicting evidence in the literature?
A: [4-5 sentence answer]

[Continue with 14 MORE tough questions]

IMPORTANT:
- Each line must start with either "Q:" or "A:"
- No numbering or bullets
- Each Q must have a corresponding A immediately after
- Generate ALL 48 questions (16 + 16 + 16)`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.7,
    max_tokens: 24000, // Tripled for 48 Q&A pairs
  });

  const rawContent = response.choices[0]?.message?.content || '';

  // Validate that we actually got Q&A content
  const hasQuestions = rawContent.includes('Q:') && rawContent.includes('A:');
  if (!hasQuestions) {
    console.warn('[Defense Questions] ⚠️ Groq returned no Q&A content, generating fallback...');
    // Return a fallback message instead of empty tables
    return `**Note:** Defense questions generation failed. Please regenerate or add manually.\n\nThe AI model did not generate questions for this paper.`;
  }

  console.log(`[Defense Questions] ✅ Generated ${(rawContent.match(/Q:/g) || []).length} questions`);

  // Post-process to create proper single-column banded markdown tables
  return formatDefenseQuestionsAsTable(rawContent);
}

/**
 * Formats Q&A text with clear numbering and spacing for easy reading
 */
function formatDefenseQuestionsAsTable(rawText: string): string {
  const sections = rawText.split(/##\s+/);
  let formatted = '';
  let questionNumber = 1;

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n').filter(l => l.trim());
    if (lines.length === 0) continue;

    // First line is the section heading
    const heading = lines[0].trim();
    formatted += `## ${heading}\n\n`;

    // Add visual separator for intensity level
    if (heading.toLowerCase().includes('simple')) {
      formatted += `🟢 **SIMPLE INTENSITY** - Basic factual questions\n\n`;
    } else if (heading.toLowerCase().includes('moderate')) {
      formatted += `---\n\n🟡 **MODERATE INTENSITY** - Critical thinking required\n\n`;
    } else if (heading.toLowerCase().includes('tough')) {
      formatted += `---\n\n🔴 **TOUGH INTENSITY** - Advanced analysis\n\n`;
    }

    // Process Q&A pairs with numbering
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('Q:')) {
        const question = line.replace(/^Q:\s*/, '');
        formatted += `**Q${questionNumber}.** ${question}\n\n`;
      } else if (line.startsWith('A:')) {
        const answer = line.replace(/^A:\s*/, '');
        formatted += `**A${questionNumber}.** ${answer}\n\n`;
        questionNumber++;
      }
    }

    formatted += '\n';
  }

  return formatted;
}

/**
 * Generate Research Methodology Glossary - Simplified for residents without biostatistics background
 */
async function generateResearchGlossary(content: PaperContent): Promise<string> {
  const glossary = `
| Term | Simple Explanation | Example from Daily Life | Why It Matters Here |
|------|-------------------|------------------------|---------------------|
| **P-value** | The chance that the results happened by random luck rather than a real effect. Lower = less likely to be luck. Think: "Could I flip a coin and get these results by accident?" | If you flip a coin 10 times and get 9 heads, p-value tells you how weird that is (p=0.02 means only 2% chance of happening by luck). | p<0.05 means less than 5% chance results are flukes. p=0.001 is stronger evidence than p=0.04. |
| **Alpha (α)** | The threshold we set BEFORE the study for what counts as "significant." Usually 0.05 (5%). It's the acceptable risk of calling something real when it's actually luck. | Like setting a rule: "I'll only believe this coin is rigged if I see 9+ heads out of 10 flips." You decide the rule BEFORE flipping. | If researchers "move the goalposts" after seeing results, that's cheating. Alpha must be set upfront. |
| **Sample Size (N)** | How many people/events were studied. Bigger = more reliable, like polling more voters gives better election predictions. | Asking 10 friends who they're voting for vs. asking 10,000 strangers. Which is more reliable? | Small N = results might be flukes. Large N = more confident results reflect reality. Underpowered studies waste time. |
| **Confidence Interval (CI)** | The range where the TRUE effect probably lives. "95% CI" means we're 95% sure the real answer is somewhere in this range. | If I say "the average height is 170cm (95% CI: 165-175cm)," I'm 95% sure the true average is between 165-175cm. | Narrow CI = precise estimate. Wide CI = uncertain. If CI crosses 1.0 (for ratios) or 0 (for differences), result might be meaningless. |
| **Number Needed to Treat (NNT)** | How many patients you must treat to help ONE additional person. Lower = better. NNT=5 means treat 5 people, help 1 extra person compared to placebo. | If 10% on placebo improve and 30% on drug improve, difference is 20%, so NNT = 1/0.20 = 5. Treat 5 to help 1 extra. | NNT=2 is amazing (treat 2, help 1). NNT=50 is weak (treat 50, help 1). NNT=100+ is borderline useless. |
| **Number Needed to Harm (NNH)** | How many patients you must treat to HARM one additional person. Higher = safer. NNH=100 means treat 100 people, harm 1 extra compared to placebo. | If 2% on placebo get side effects and 3% on drug get side effects, NNH = 1/0.01 = 100. | Compare NNT vs NNH. If NNT=5 and NNH=200, good trade-off. If NNT=100 and NNH=20, bad trade-off (harm more than help). |
| **Hazard Ratio (HR)** | Compares SPEED of events between groups over time. HR=2 means events happen twice as fast in one group. HR=0.5 means half as fast (protective). | If HR for death = 0.6 for drug vs placebo, death happens 40% slower with drug (60% of placebo speed). | HR=1.0 = no difference. HR>1 = increased risk. HR<1 = decreased risk. HR=0.5 means 50% reduction in hazard rate. |
| **Relative Risk (RR)** | Compares PROBABILITY of events between groups. RR=2 means twice the probability. RR=0.5 means half the probability. | If 10% of controls get disease and 20% of exposed get disease, RR = 20%/10% = 2.0 (doubled risk). | RR=1.0 = no association. RR>1 = increased risk. RR<1 = decreased risk. RR can overstate importance if baseline risk is tiny. |
| **Odds Ratio (OR)** | Similar to RR but uses ODDS instead of probabilities. Used in case-control studies and logistic regression. OR≈RR when outcome is rare (<10%). | If 1/100 smokers get cancer (1% = 1:99 odds) vs 2/100 nonsmokers (2% = 2:98 odds), OR ≈ 0.5. | OR>1 = increased odds. OR<1 = decreased odds. When outcome is common (>10%), OR exaggerates effect compared to RR. |
| **Absolute Risk Reduction (ARR)** | The simple DIFFERENCE in outcome rates between groups. More clinically meaningful than relative measures. | If 10% on placebo die and 5% on drug die, ARR = 10% - 5% = 5%. You save 5 extra lives per 100 treated. | ARR shows REAL-WORLD impact. Drug might reduce risk by "50%" (RR=0.5) but ARR might only be 0.1% (not very useful). |
| **Intention-to-Treat (ITT)** | Analyze people in the groups they were ASSIGNED to, even if they didn't take the treatment or switched groups. Conservative but realistic. | If you randomize 100 to drug but 20 quit, still analyze all 100 in drug group. Mirrors real-world compliance. | ITT is the gold standard. Prevents bias from dropouts. More realistic than "per-protocol." |
| **Per-Protocol Analysis** | Analyze only people who ACTUALLY followed the protocol (took meds, attended visits, etc.). Can overestimate benefit. | Exclude the 20 who quit. Only analyze the 80 who took drug perfectly. Makes drug look better than reality. | Less realistic than ITT. Use ITT for decision-making, per-protocol for understanding "ideal scenario." |
| **Statistical Power** | The ability to DETECT a real effect if it exists. Power=80% means 80% chance of finding a real effect. Low power = might miss real benefits. | Like using binoculars to spot birds. Weak binoculars (low power) = miss birds even if they're there. | Underpowered studies (<80%) waste time and money. Might falsely conclude "no effect" when effect exists but study was too small. |
| **Type I Error (False Positive)** | Concluding there IS an effect when there ISN'T (crying wolf). Alpha sets the acceptable rate (usually 5%). | Finding your "lost" keys in your pocket after searching the house. You falsely thought they were lost. | p<0.05 means 5% risk of false positive. Multiple comparisons increase false positives (do 20 tests, expect 1 false positive by chance). |
| **Type II Error (False Negative)** | Concluding there is NO effect when there IS one (missing a real signal). Beta sets the rate. Power = 1 - Beta. | Having your keys in the drawer but not checking there, so you conclude they're lost. | Underpowered studies have high Type II error risk. Might miss real benefits because study was too small. |
| **Multiple Comparisons Problem** | The more tests you do, the more likely you are to find "significant" results by pure luck. Needs correction (Bonferroni, etc.). | Flip 20 coins. At least one will probably give ≥8 heads just by luck. Doesn't mean that coin is rigged. | If study tests 50 outcomes without correction, expect ~2-3 false positives even if nothing is real. Beware "p-hacking." |
| **Selection Bias** | When the people IN your study differ systematically from the people you WANT to generalize to. Threatens external validity. | Surveying gym-goers about exercise habits. They're fitter than general population. Results won't apply to couch potatoes. | If study only includes young, healthy volunteers, results might not apply to elderly or sick patients. Check inclusion/exclusion criteria. |
| **Confounding** | When a third variable is associated with BOTH exposure and outcome, creating a fake association. Needs adjustment (regression, matching, stratification). | Ice cream sales correlate with drowning deaths. Confounder = hot weather (causes both more ice cream AND more swimming). | Observational studies are plagued by confounding. Randomization prevents it. Look for adjusted analyses that control for confounders. |
| **Effect Modification (Interaction)** | When the effect of treatment DIFFERS across subgroups. Treatment works better in men than women, for example. | Aspirin prevents heart attacks in people with heart disease but not in healthy young adults. Effect depends on baseline risk. | Beware subgroup analyses (often false positives). Prespecified interactions are more trustworthy than post-hoc fishing expeditions. |
| **Surrogate Endpoint** | A substitute outcome (like cholesterol level) instead of the outcome we actually care about (like heart attacks). Risky if surrogate doesn't predict real outcome. | Lowering blood pressure (surrogate) vs. preventing strokes (patient-important). Drugs can lower BP without preventing strokes. | Surrogate endpoints speed up trials but can mislead. Always ask: "Does this surrogate reliably predict outcomes patients care about?" |
| **Composite Endpoint** | Combining multiple outcomes into one (like "death, MI, or stroke"). Can inflate effect size if includes trivial outcomes. | "Death or hospitalization" sounds bad, but if 95% are hospitalizations (not deaths), composite hides that mortality wasn't reduced. | Check what's IN the composite. If driven by soft outcomes (revascularization, hospitalization), might overstate benefit. |

**Note:** These are simplified for journal club presentation. For rigorous statistical work, consult a biostatistician.
`;

  return glossary;
}

/**
 * Generate clinical question (PICO format)
 */
async function generateClinicalQuestion(content: PaperContent): Promise<string> {
  const prompt = `Analyze this research paper and create a single, focused clinical question in PICO format.

${content.markdown.substring(0, 3000)}

Format as a single clear question like:
"In [population], does [intervention] compared to [comparator] result in [outcome]?"

Keep it concise and clinically focused.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 1800,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate bottom line (2-3 sentence summary)
 */
async function generateBottomLine(content: PaperContent): Promise<string> {
  const prompt = `Provide a concise "Bottom Line" summary of this study in exactly 2-3 sentences.

${content.markdown.substring(0, 4000)}

Include:
1. What was found (key result)
2. Clinical significance (why it matters)

Be direct and actionable. This should give clinicians the essential takeaway.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.5,
    max_tokens: 900,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate study design (bulleted format)
 */
async function generateStudyDesign(content: PaperContent): Promise<string> {
  const prompt = `Extract the study design details in a clean bulleted format.

${content.markdown.substring(0, 3000)}

Provide:
- **Study Type:** [RCT, Cohort, etc.]
- **Sample Size:** [N total, groups if applicable]
- **Setting:** [Where conducted]
- **Enrollment:** [Start-end dates]
- **Follow-up:** [Duration]
- **Analysis:** [ITT, Per-protocol, etc.]
- **Primary Outcome:** [What was measured]

Only include bullets for information actually present in the paper.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 1800,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate criticisms (simple bulleted list)
 */
async function generateCriticisms(content: PaperContent): Promise<string> {
  const prompt = `Identify 4-6 key criticisms or limitations of this study.

${content.markdown}

Provide as a simple bulleted list. Each criticism should be:
- One clear limitation or methodological concern
- Brief (1-2 sentences)
- Clinically relevant

Focus on the most important issues that affect interpretation and generalizability.`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.5,
    max_tokens: 2400,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate funding section
 */
async function generateFunding(content: PaperContent): Promise<string> {
  const prompt = `Extract funding information from this paper.

${content.markdown.substring(0, 8000)}

Provide a brief statement about:
- Who funded the study
- Any conflicts of interest mentioned

If no funding information is found, return "Not specified in the paper."`;

  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 900,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate related research section
 */
async function generateRelatedResearch(content: PaperContent): Promise<string> {
  return `### Related Research

NA (OpenAlex API integration planned for Phase 2)`;
}
