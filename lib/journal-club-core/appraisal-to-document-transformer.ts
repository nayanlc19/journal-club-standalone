/**
 * Appraisal to Document Transformer
 * Converts GeneratedAppraisal (17 markdown sections) into DocumentData for document generators
 */

import { DocumentData, DocumentSection, ChecklistItem, ImageData } from './document-generators/index.js';
import { TableFigure } from './vision-extractor.js';

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
 * Extract term definitions from markdown text
 * Looks for patterns like:
 * - **Term**: explanation
 * - Term: explanation
 * - "Term" - explanation
 */
function extractTermDefinitions(text: string): Record<string, string> {
  const definitions: Record<string, string> = {};

  // Pattern 1: **Term**: explanation
  const boldPattern = /\*\*([^*]+)\*\*:\s*([^\n]+)/g;
  let match;

  while ((match = boldPattern.exec(text)) !== null) {
    const term = match[1].trim();
    const definition = match[2].trim();
    if (term.length > 0 && definition.length > 10) {
      definitions[term] = definition;
    }
  }

  // Pattern 2: Term (Acronym): explanation
  const acronymPattern = /([A-Z][a-zA-Z\s]+)\s*\(([A-Z]{2,})\):\s*([^\n]+)/g;

  while ((match = acronymPattern.exec(text)) !== null) {
    const fullTerm = match[1].trim();
    const acronym = match[2].trim();
    const definition = match[3].trim();

    if (definition.length > 10) {
      definitions[acronym] = `${fullTerm}: ${definition}`;
    }
  }

  return definitions;
}

/**
 * Extract teaching notes from content
 * Looks for bullet points, numbered lists, and key insights
 */
function extractTeachingNotes(text: string): string[] {
  const notes: string[] = [];

  // Extract bullet points
  const bulletPattern = /^[•\-*]\s+(.+)$/gm;
  let match;

  while ((match = bulletPattern.exec(text)) !== null) {
    const note = match[1].trim();
    if (note.length > 20) {
      notes.push(note);
    }
  }

  // Extract numbered points
  const numberedPattern = /^\d+\.\s+(.+)$/gm;

  while ((match = numberedPattern.exec(text)) !== null) {
    const note = match[1].trim();
    if (note.length > 20 && !notes.includes(note)) {
      notes.push(note);
    }
  }

  return notes.slice(0, 10); // Limit to 10 most important notes
}

/**
 * Parse checklist markdown into structured ChecklistItem[]
 */
function parseChecklistItems(checklistMarkdown: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // Look for patterns like:
  // ✅ Item description | Present/Absent
  // 🟢 Domain: Assessment

  const lines = checklistMarkdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and headers
    if (!line || line.startsWith('#') || line.startsWith('---')) {
      continue;
    }

    // Pattern: ✅/❌/⚠️/🟢/🟡/🔴 followed by text
    const emojiMatch = line.match(/^[✅❌⚠️🟢🟡🔴]\s+(.+)$/);

    if (emojiMatch) {
      const content = emojiMatch[1];

      // Try to split by | or : to get assessment
      const parts = content.split(/[:|]/);
      const itemText = parts[0].trim();
      const assessment = parts[1]?.trim() || 'See details';

      // Extract rationale from following lines (if indented or starting with "-")
      let rationale = 'Critical for study quality assessment.';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('-') || nextLine.startsWith('  ')) {
          rationale = nextLine.replace(/^[-\s]+/, '').trim();
        }
      }

      items.push({
        item: itemText,
        rationale,
        assessment,
      });
    }
  }

  // If no items found, create generic ones from the content
  if (items.length === 0) {
    const sections = checklistMarkdown.split(/#{2,3}\s+/);
    for (const section of sections.slice(1)) {
      const lines = section.split('\n');
      const title = lines[0];
      const content = lines.slice(1).join(' ').trim();
      if (title && content.length > 20) {
        items.push({
          item: title,
          rationale: content.substring(0, 150) + '...',
          assessment: 'See detailed assessment above',
        });
      }
    }
  }

  return items;
}

/**
 * Extract study metadata from paper basics
 */
function extractMetadata(paperBasics: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Extract DOI
  const doiMatch = paperBasics.match(/DOI:\s*([^\s\n]+)/i);
  if (doiMatch) {
    metadata.doi = doiMatch[1];
  }

  // Extract author
  const authorMatch = paperBasics.match(/Author[s]?:\s*([^\n]+)/i);
  if (authorMatch) {
    metadata.author = authorMatch[1];
  }

  // Extract journal
  const journalMatch = paperBasics.match(/Journal:\s*([^\n]+)/i);
  if (journalMatch) {
    metadata.journal = journalMatch[1];
  }

  // Extract year
  const yearMatch = paperBasics.match(/Year:\s*(\d{4})/i);
  if (yearMatch) {
    metadata.year = yearMatch[1];
  }

  return metadata;
}

/**
 * Convert base64 image markdown to ImageData[]
 */
function extractImagesFromMarkdown(tablesAndFigures: string): ImageData[] {
  const images: ImageData[] = [];

  // Pattern: ![Title](data:image/png;base64,...)
  const imagePattern = /!\[([^\]]+)\]\(data:image\/[^;]+;base64,([^)]+)\)/g;
  let match;

  while ((match = imagePattern.exec(tablesAndFigures)) !== null) {
    const title = match[1].trim();
    const base64 = match[2].trim();

    // Extract explanation from surrounding text
    const start = Math.max(0, match.index - 200);
    const end = Math.min(tablesAndFigures.length, match.index + match[0].length + 200);
    const context = tablesAndFigures.substring(start, end);

    // Look for explanation after image
    const explainMatch = context.match(/\n([^!\n][^\n]{20,})/);
    const explanation = explainMatch ? explainMatch[1].trim() : `${title} from the study.`;

    images.push({
      title,
      base64,
      explanation,
    });
  }

  return images;
}

/**
 * Clean markdown for PDF (remove some markdown syntax)
 */
function cleanContentForPdf(content: string): string {
  if (!content) return '';

  return content
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/^[-*+]\s+/gm, '• ') // Normalize bullets
    .trim();
}

/**
 * Remove ALL markdown formatting for Educational document (proper ebook style)
 */
function removeAllMarkdown(content: string): string {
  if (!content) return '';

  return content
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/^[-*+]\s+/gm, '• ') // Normalize bullets to proper bullet points
    .replace(/^\d+\.\s+/gm, (match, offset, string) => {
      // Keep numbered lists but ensure proper formatting
      const lineNum = string.substring(0, offset).split('\n').length;
      return `${lineNum}. `;
    })
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/\|/g, ' ') // Replace table delimiters with spaces
    .replace(/^-{3,}$/gm, '') // Remove horizontal rules
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();
}

/**
 * Split images between methods and results sections
 */
function categorizeImages(images: ImageData[]): {
  methodsImages: ImageData[];
  resultsImages: ImageData[];
  otherImages: ImageData[];
} {
  const methodsImages: ImageData[] = [];
  const resultsImages: ImageData[] = [];
  const otherImages: ImageData[] = [];

  images.forEach(img => {
    const titleLower = img.title.toLowerCase();

    if (titleLower.includes('consort') ||
        titleLower.includes('flow') ||
        titleLower.includes('protocol') ||
        titleLower.includes('design') ||
        titleLower.includes('randomization')) {
      methodsImages.push(img);
    } else if (titleLower.includes('table') ||
               titleLower.includes('result') ||
               titleLower.includes('outcome') ||
               titleLower.includes('kaplan') ||
               titleLower.includes('forest') ||
               titleLower.includes('comparison')) {
      resultsImages.push(img);
    } else {
      otherImages.push(img);
    }
  });

  return { methodsImages, resultsImages, otherImages };
}

/**
 * Extract strengths from critical analysis and impact sections
 */
function extractStrengths(criticalAnalysis: string, impactEvidence: string): string {
  const content = `${criticalAnalysis}\n\n${impactEvidence}`;

  // Look for strengths markers
  const strengthsMatch = content.match(/(?:strengths?|advantages?|positive aspects?)[\s\S]*?(?=weaknesses?|limitations?|criticisms?|$)/i);

  if (strengthsMatch) {
    return strengthsMatch[0].trim();
  }

  // Fallback: extract positive statements
  const lines = content.split('\n');
  const positiveLines = lines.filter(line =>
    /robust|strong|well-designed|rigorous|high quality|appropriate|comprehensive/i.test(line)
  );

  return positiveLines.length > 0
    ? positiveLines.join('\n')
    : 'See Critical Analysis section for study strengths.';
}

/**
 * Extract weaknesses from criticisms and critical analysis
 */
function extractWeaknesses(criticisms: string, criticalAnalysis: string): string {
  const content = `${criticisms}\n\n${criticalAnalysis}`;

  // Look for weakness/limitation markers
  const weaknessMatch = content.match(/(?:weaknesses?|limitations?|criticisms?|concerns?)[\s\S]*?(?=strengths?|conclusion?|$)/i);

  if (weaknessMatch) {
    return weaknessMatch[0].trim();
  }

  // Use criticisms section directly if available
  if (criticisms && criticisms.length > 50) {
    return criticisms;
  }

  // Fallback: extract negative statements
  const lines = content.split('\n');
  const negativeLines = lines.filter(line =>
    /limitation|weakness|concern|bias|small sample|lack of|did not|failed to|unclear/i.test(line)
  );

  return negativeLines.length > 0
    ? negativeLines.join('\n')
    : 'See Critical Analysis section for study limitations.';
}

/**
 * Transform GeneratedAppraisal to DocumentData
 */
export function transformAppraisalToDocuments(
  appraisal: GeneratedAppraisal,
  visionImages?: TableFigure[]
): { gammaData: DocumentData; educationalData: DocumentData } {

  // Extract metadata
  const metadata = extractMetadata(appraisal.paperBasics);

  // Extract images from markdown or use vision images
  const images = visionImages?.length
    ? visionImages.map(tf => ({
        title: tf.title,
        base64: tf.imageBase64 || '',
        explanation: tf.explanation,
        pageNumber: tf.pageNumber,
      }))
    : extractImagesFromMarkdown(appraisal.tablesAndFigures);

  // Categorize images for appropriate placement
  const { methodsImages, resultsImages, otherImages } = categorizeImages(images);

  // Parse checklist
  const checklistItems = parseChecklistItems(appraisal.criticalAppraisalChecklist);

  // Create title from clinical question or paper basics
  const title = appraisal.clinicalQuestion || 'Critical Appraisal';

  //
  // GAMMA DOCUMENT (Pure markdown for Gamma AI to parse - keeps tables, formatting intact)
  //
  const gammaSections: DocumentSection[] = [
    {
      heading: 'Paper Basics',
      content: appraisal.paperBasics, // Title page - keep as first slide
      images: [],
    },
    {
      heading: 'Study Design',
      content: appraisal.studyDesign,
      images: [],
    },
    {
      heading: 'Historical Context and Impact',
      content: appraisal.historicalContext,
      images: [],
    },
    {
      heading: 'Critical Appraisal Checklist',
      content: appraisal.criticalAppraisalChecklist, // Keep markdown tables intact
      images: [],
    },
    {
      heading: 'Results',
      content: appraisal.resultsInterpretation, // Complex/technical language
      images: resultsImages,
    },
    {
      heading: 'Tables and Figures',
      content: appraisal.tablesAndFigures, // Keep markdown tables
      images: images, // All extracted images
    },
    {
      heading: 'Critical Analysis',
      content: appraisal.criticalAnalysis,
      images: [],
    },
    {
      heading: 'Strengths',
      content: extractStrengths(appraisal.criticalAnalysis, appraisal.impactAndEvidence),
      images: [],
    },
    {
      heading: 'Weaknesses',
      content: extractWeaknesses(appraisal.criticisms, appraisal.criticalAnalysis),
      images: [],
    },
    {
      heading: 'Study Impact',
      content: appraisal.impactAndEvidence,
      images: [],
    },
    {
      heading: 'Clinical Implications',
      content: appraisal.bottomLine,
      images: [],
    },
    {
      heading: 'Funding and Conflict of Interest',
      content: appraisal.funding,
      images: [],
    },
    {
      heading: 'Related Research from the Web',
      content: appraisal.relatedResearch,
      images: [],
    },
    {
      heading: 'Executive Summary',
      content: appraisal.executiveSummary, // LAST slide
      images: [],
    },
  ];

  const gammaData: DocumentData = {
    title,
    metadata,
    sections: gammaSections,
  };

  //
  // EDUCATIONAL DOCUMENT (No markdown, comprehensive ebook-style)
  //
  const educationalSections: DocumentSection[] = [
    {
      heading: 'Paper Basics',
      content: removeAllMarkdown(appraisal.paperBasics), // Remove all markdown
      explanations: extractTermDefinitions(appraisal.paperBasics),
      teaching_notes: extractTeachingNotes(appraisal.paperBasics),
      images: [],
    },
    {
      heading: 'Executive Summary',
      content: removeAllMarkdown(appraisal.executiveSummary),
      explanations: extractTermDefinitions(appraisal.executiveSummary),
      teaching_notes: [
        'This summary provides the complete overview of the study',
        'Focus on understanding the main findings and their implications',
      ],
      images: [],
    },
    {
      heading: 'Study Design',
      content: removeAllMarkdown(appraisal.studyDesign),
      explanations: {
        'RCT': 'Randomized Controlled Trial - participants are randomly assigned to treatment or control groups',
        'Blinding': 'Keeping participants and/or investigators unaware of treatment assignment to reduce bias',
        'Placebo': 'An inactive treatment that looks identical to the real treatment',
        'Intention-to-treat': 'Analyzing participants based on their original group assignment, regardless of adherence',
      },
      teaching_notes: extractTeachingNotes(appraisal.studyDesign),
      images: [],
    },
    {
      heading: 'Historical Context & Impact',
      content: removeAllMarkdown(appraisal.historicalContext),
      explanations: extractTermDefinitions(appraisal.historicalContext),
      teaching_notes: [
        'Understanding the historical context helps appreciate why this study was important',
        'Consider what was known before this study and what gap it aimed to fill',
      ],
      images: [],
    },
    {
      heading: 'Critical Appraisal Checklist',
      content: removeAllMarkdown(appraisal.criticalAppraisalChecklist),
      checklist_items: checklistItems,
      explanations: {
        'Internal validity': 'How well the study was conducted and whether results are trustworthy',
        'External validity': 'How well results can be applied to other populations',
        'Bias': 'Systematic errors that can affect study results',
      },
      images: [],
    },
    {
      heading: 'Methods (How They Did It)',
      content: removeAllMarkdown(appraisal.methodsDeepDive),
      explanations: {
        'Sample size': 'The number of participants needed to detect a meaningful difference',
        'Power': 'The probability of detecting a true effect if it exists (usually 80%)',
        'P-value': 'The probability results occurred by chance (< 0.05 considered significant)',
        ...extractTermDefinitions(appraisal.methodsDeepDive),
      },
      teaching_notes: [
        'The methods section tells us exactly how the study was conducted',
        'Pay attention to who was studied and what was measured',
      ],
      images: [],
    },
    {
      heading: 'Results Interpretation (Simple Language)',
      content: removeAllMarkdown(appraisal.resultsInterpretation),
      explanations: extractTermDefinitions(appraisal.resultsInterpretation),
      teaching_notes: [
        'Focus on the primary outcome first - this is the main result',
        'Secondary outcomes provide additional insights but are exploratory',
        'Look at both statistical significance AND clinical importance',
      ],
      images: [],
    },
    {
      heading: 'Tables and Figures',
      content: removeAllMarkdown(appraisal.tablesAndFigures),
      images: images,
      explanations: {
        'Confidence interval': 'Range where the true effect likely falls (95% of the time)',
        'Hazard ratio': 'Risk of event in treatment group vs control group',
        'Number needed to treat': 'How many patients need treatment for one to benefit',
      },
      teaching_notes: [
        'Tables summarize data in organized format',
        'Figures visualize trends and relationships',
        'Always check figure legends and table footnotes for important details',
      ],
    },
    {
      heading: 'Strengths & Limitations',
      content: removeAllMarkdown(appraisal.criticalAnalysis),
      explanations: {
        'Selection bias': 'When study participants differ from target population',
        'Attrition bias': 'When participants drop out non-randomly',
        'Detection bias': 'When outcome assessment is influenced by knowledge of treatment',
        ...extractTermDefinitions(appraisal.criticalAnalysis),
      },
      teaching_notes: [
        'Every study has both strengths and limitations',
        'Understanding limitations helps interpret results correctly',
      ],
      images: [],
    },
    {
      heading: 'Study Impact',
      content: removeAllMarkdown(appraisal.impactAndEvidence),
      explanations: extractTermDefinitions(appraisal.impactAndEvidence),
      teaching_notes: [
        'Consider how this study changed clinical practice',
        'Look at subsequent studies that built on these findings',
        'Understand the current state of evidence in 2025',
      ],
      images: [],
    },
    {
      heading: 'Clinical Implications',
      content: removeAllMarkdown(appraisal.bottomLine),
      explanations: extractTermDefinitions(appraisal.bottomLine),
      teaching_notes: [
        'How should this change your practice?',
        'Which patients would benefit from these findings?',
        'What questions remain unanswered?',
      ],
      images: [],
    },
    {
      heading: 'Defense Questions & Answers',
      content: removeAllMarkdown(appraisal.defenseQuestions),
      explanations: extractTermDefinitions(appraisal.defenseQuestions),
      teaching_notes: [
        'Anticipate questions about study validity',
        'Be ready to discuss clinical applicability',
        'Understand both strengths and limitations',
      ],
      images: [],
    },
    {
      heading: 'Funding or Conflict of Interest',
      content: removeAllMarkdown(appraisal.funding),
      explanations: {
        'Conflict of interest': 'Financial or other relationships that could bias results',
        'Industry funding': 'When pharmaceutical or device companies fund research',
        'Investigator-initiated': 'Studies designed and run by academic researchers',
      },
      teaching_notes: [
        'Funding source can influence study design and interpretation',
        'Disclosure of conflicts is required for transparency',
      ],
      images: [],
    },
    {
      heading: 'Related Research from Web',
      content: removeAllMarkdown(appraisal.relatedResearch),
      explanations: extractTermDefinitions(appraisal.relatedResearch),
      teaching_notes: [
        'Compare findings with other similar studies',
        'Look for meta-analyses that include this study',
        'Check clinical guidelines for current recommendations',
      ],
      images: [],
    },
  ];

  const educationalData: DocumentData = {
    title,
    metadata,
    sections: educationalSections,
  };

  return { gammaData, educationalData };
}

/**
 * Convert DocumentData (gammaData) to markdown string
 * This skips the Word file generation and provides markdown directly for Gamma API
 *
 * NOTE: Starts directly with Paper Basics section - NO PICO question header
 * Paper Basics already contains Title, Authors, Journal, DOI
 */
export function documentDataToMarkdown(data: DocumentData): string {
  const lines: string[] = [];

  // Process each section - Paper Basics is first and contains all metadata
  for (const section of data.sections) {
    // Section heading
    if (section.heading) {
      lines.push(`## ${section.heading}\n`);
    }

    // Section content (already in markdown format)
    if (section.content) {
      lines.push(section.content);
      lines.push(''); // blank line after content
    }

    // Note: Images are embedded in content or ignored for API
    // Gamma API doesn't support image upload, only URLs in text
  }

  return lines.join('\n');
}