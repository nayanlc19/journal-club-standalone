/**
 * PPT Slide Content Formatter
 * Extracts key points for slides and detailed explanations for notes
 */

import { GeneratedAppraisal } from '../text-generator.js';

export interface SlideContent {
  slideNumber: number;
  title: string;
  bulletPoints: string[];
  notes: string;
  imageUrl?: string;
}

export interface PresentationStructure {
  title: string;
  subtitle: string;
  slides: SlideContent[];
  totalSlides: number;
}

/**
 * Format critical appraisal content for PowerPoint presentation
 * Slides: Key points, findings, visuals
 * Notes: Detailed explanations, statistics, methodology
 */
export function formatForPresentation(
  appraisal: GeneratedAppraisal,
  paperTitle: string,
  doi?: string
): PresentationStructure {
  const slides: SlideContent[] = [];
  
  // Slide 1: Title
  slides.push({
    slideNumber: 1,
    title: paperTitle || 'Critical Appraisal',
    bulletPoints: [
      'Journal Club Presentation',
      doi ? `DOI: ${doi}` : '',
      'Evidence-Based Critical Appraisal'
    ].filter(Boolean),
    notes: 'Introduction slide. Presenter should state the paper title clearly and mention the journal where it was published.',
  });
  
  // Slide 2: Study Overview (from paperBasics)
  const studyOverview = extractStudyOverview(appraisal.paperBasics);
  slides.push({
    slideNumber: 2,
    title: 'Study Overview',
    bulletPoints: studyOverview.bullets,
    notes: studyOverview.notes,
  });
  
  // Slide 3: Why This Study? (from historicalContext)
  const rationale = extractRationale(appraisal.historicalContext);
  slides.push({
    slideNumber: 3,
    title: 'Why This Study?',
    bulletPoints: rationale.bullets,
    notes: rationale.notes,
  });
  
  // Slide 4: Methods (from methodsDeepDive)
  const methods = extractMethodsSummary(appraisal.methodsDeepDive);
  slides.push({
    slideNumber: 4,
    title: 'Methods',
    bulletPoints: methods.bullets,
    notes: methods.notes,
  });
  
  // Slide 5-7: Key Findings (from resultsInterpretation + tablesAndFigures)
  const findings = extractKeyFindings(appraisal.resultsInterpretation, appraisal.tablesAndFigures);
  findings.forEach((finding, idx) => {
    slides.push({
      slideNumber: 5 + idx,
      title: finding.title,
      bulletPoints: finding.bullets,
      notes: finding.notes,
      imageUrl: finding.imageUrl,
    });
  });
  
  // Slide 8: Critical Appraisal (from criticalAppraisalChecklist)
  const appraisalSummary = extractAppraisalSummary(appraisal.criticalAppraisalChecklist);
  slides.push({
    slideNumber: 5 + findings.length,
    title: 'Critical Appraisal',
    bulletPoints: appraisalSummary.bullets,
    notes: appraisalSummary.notes,
  });
  
  // Slide 9: Strengths & Limitations (from criticalAnalysis)
  const strengthsLimitations = extractStrengthsLimitations(appraisal.criticalAnalysis);
  slides.push({
    slideNumber: 6 + findings.length,
    title: 'Strengths & Limitations',
    bulletPoints: strengthsLimitations.bullets,
    notes: strengthsLimitations.notes,
  });
  
  // Slide 10: Clinical Implications
  const implications = extractClinicalImplications(appraisal.criticalAnalysis);
  slides.push({
    slideNumber: 7 + findings.length,
    title: 'Clinical Implications',
    bulletPoints: implications.bullets,
    notes: implications.notes,
  });
  
  // Slide 11: Defense Questions Preview
  const defensePreview = extractDefensePreview(appraisal.defenseQuestions);
  slides.push({
    slideNumber: 8 + findings.length,
    title: 'Potential Questions',
    bulletPoints: defensePreview.bullets,
    notes: defensePreview.notes,
  });
  
  return {
    title: paperTitle || 'Critical Appraisal',
    subtitle: 'Journal Club Presentation',
    slides,
    totalSlides: slides.length,
  };
}

/**
 * Extract study overview (PICO) for slide
 */
function extractStudyOverview(paperBasics: string): { bullets: string[]; notes: string } {
  const bullets: string[] = [];
  const lines = paperBasics.split('\n').filter(l => l.trim());
  
  // Extract study type
  const studyTypeLine = lines.find(l => l.includes('Study Type:'));
  if (studyTypeLine) bullets.push(studyTypeLine.replace(/\*\*/g, '').trim());
  
  // Extract PICO
  const picoSection = paperBasics.match(/### PICO Framework([\s\S]*?)(?=###|$)/);
  if (picoSection) {
    const picoLines = picoSection[1].split('\n').filter(l => l.includes('**')).slice(0, 4);
    bullets.push(...picoLines.map(l => l.replace(/- \*\*/g, '').replace(/\*\*/g, ': ').trim()));
  }
  
  return {
    bullets: bullets.slice(0, 5),
    notes: paperBasics, // Full details in notes
  };
}

/**
 * Extract study rationale
 */
function extractRationale(historicalContext: string): { bullets: string[]; notes: string } {
  const bullets: string[] = [];
  
  // Extract "Why This Study Was Conducted" section
  const whySection = historicalContext.match(/### Why This Study Was Conducted([\s\S]*?)(?=###|$)/);
  if (whySection) {
    const points = whySection[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 3);
    bullets.push(...points.map(p => p.replace(/^- /, '').trim()));
  }
  
  // Add impact point
  const impactSection = historicalContext.match(/### Impact on Science/);
  if (impactSection) {
    bullets.push('Significant impact on clinical practice');
  }
  
  return {
    bullets: bullets.slice(0, 4),
    notes: historicalContext,
  };
}

/**
 * Extract methods summary
 */
function extractMethodsSummary(methodsDeepDive: string): { bullets: string[]; notes: string } {
  const bullets: string[] = [];
  
  // Look for key sections
  const sections = ['Sample Size', 'Randomization', 'Blinding', 'Statistical'];
  sections.forEach(section => {
    const match = methodsDeepDive.match(new RegExp(`### ${section}([\\s\\S]*?)(?=###|$)`));
    if (match) {
      const firstSentence = match[1].split('.')[0].replace(/^[\s\n"]+/, '').trim();
      if (firstSentence) bullets.push(`**${section}:** ${firstSentence}`);
    }
  });
  
  return {
    bullets: bullets.slice(0, 4),
    notes: methodsDeepDive,
  };
}

/**
 * Extract key findings with tables/figures
 */
function extractKeyFindings(results: string, tablesAndFigures: string): Array<{title: string; bullets: string[]; notes: string; imageUrl?: string}> {
  const findings: Array<{title: string; bullets: string[]; notes: string; imageUrl?: string}> = [];
  
  // Extract primary outcome
  const primaryMatch = results.match(/\*\*Primary Outcome[\s\S]*?(?=\*\*|$)/i);
  if (primaryMatch) {
    const bullets = primaryMatch[0].split('\n').filter(l => l.trim() && !l.includes('**')).slice(0, 3);
    findings.push({
      title: 'Primary Outcome',
      bullets: bullets.map(b => b.trim()),
      notes: primaryMatch[0],
    });
  }
  
  // Extract tables/figures if available
  if (tablesAndFigures && tablesAndFigures.length > 100) {
    const imageMatches = tablesAndFigures.match(/!\[.*?\]\((data:image.*?)\)/g);
    if (imageMatches && imageMatches.length > 0) {
      imageMatches.slice(0, 2).forEach((img, idx) => {
        const imageUrl = img.match(/\((data:image.*?)\)/)?.[1];
        findings.push({
          title: `Key Figure ${idx + 1}`,
          bullets: ['See figure for details'],
          notes: 'Important visual data from the paper',
          imageUrl,
        });
      });
    }
  }
  
  return findings.slice(0, 3); // Max 3 findings slides
}

/**
 * Extract appraisal summary
 */
function extractAppraisalSummary(appraisalChecklist: string): { bullets: string[]; notes: string } {
  const bullets: string[] = [];
  
  // Extract CASP score
  const caspScore = appraisalChecklist.match(/\*\*Overall CASP Score:\*\* (\d+\/\d+.*)/);
  if (caspScore) bullets.push(caspScore[1]);
  
  // Extract RoB overall
  const robOverall = appraisalChecklist.match(/\*\*Overall Risk of Bias\*\* \| \*\*(🟢|🟡|🔴) (.*?)\*\*/);
  if (robOverall) bullets.push(`Risk of Bias: ${robOverall[2]}`);
  
  // Extract EQUATOR compliance
  const equatorComp = appraisalChecklist.match(/\*\*Compliance:\*\* .*?= \*\*(\d+%)\*\*/);
  if (equatorComp) bullets.push(`Reporting Quality: ${equatorComp[1]}`);
  
  return {
    bullets: bullets.slice(0, 4),
    notes: appraisalChecklist,
  };
}

/**
 * Extract strengths and limitations
 */
function extractStrengthsLimitations(criticalAnalysis: string): { bullets: string[]; notes: string } {
  const bullets: string[] = [];
  
  // Extract strengths
  const strengthsMatch = criticalAnalysis.match(/### Strengths([\s\S]*?)(?=###|$)/);
  if (strengthsMatch) {
    const strengths = strengthsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 2);
    bullets.push(...strengths.map(s => '✅ ' + s.replace(/^- /, '').trim()));
  }
  
  // Extract limitations
  const limitationsMatch = criticalAnalysis.match(/### Weaknesses([\s\S]*?)(?=###|$)/);
  if (limitationsMatch) {
    const limitations = limitationsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 2);
    bullets.push(...limitations.map(l => '⚠️ ' + l.replace(/^- /, '').trim()));
  }
  
  return {
    bullets: bullets.slice(0, 5),
    notes: criticalAnalysis,
  };
}

/**
 * Extract clinical implications
 */
function extractClinicalImplications(criticalAnalysis: string): { bullets: string[]; notes: string } {
  const bullets: string[] = [];
  
  const implicationsMatch = criticalAnalysis.match(/### Clinical Implications([\s\S]*?)(?=###|$)/);
  if (implicationsMatch) {
    const points = implicationsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).slice(0, 4);
    bullets.push(...points.map(p => p.replace(/^- /, '').trim()));
  }
  
  return {
    bullets: bullets.slice(0, 4),
    notes: criticalAnalysis,
  };
}

/**
 * Extract defense questions preview
 */
function extractDefensePreview(defenseQuestions: string): { bullets: string[]; notes: string } {
  const bullets: string[] = [];
  
  // Extract 3 moderate questions as preview
  const moderateMatch = defenseQuestions.match(/### Moderate Questions[\s\S]*?\*\*Q:\*\* (.*?)(?=\n)/g);
  if (moderateMatch) {
    bullets.push(...moderateMatch.slice(0, 3).map(q => {
      const question = q.match(/\*\*Q:\*\* (.*)/)?.[1];
      return question || '';
    }).filter(Boolean));
  }
  
  return {
    bullets: bullets.slice(0, 4),
    notes: defenseQuestions,
  };
}
