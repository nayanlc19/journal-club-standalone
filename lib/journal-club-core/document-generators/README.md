# Document Generators

Dual-output document generation system for medical journal critical appraisal.

## Overview

This module generates **TWO different documents** from the same critical appraisal data:

### 1. Gamma-Ready Word Document (.docx)
**Purpose:** Upload to Gamma for automatic presentation generation

**Features:**
- Clean, presentation-optimized format
- Text + embedded images (tables, graphs, figures)
- Simplified terminology (no jargon)
- NO Q&A format
- Proper headings and structure
- Ready for direct upload to Gamma

**Output:** `StudyTitle_Gamma.docx`

### 2. Comprehensive Educational PDF (.pdf)
**Purpose:** Teaching resource for medical students

**Features:**
- **Complete educational resource** - no external books needed
- **5W+H explanations** (Who, What, When, Where, Why, How)
- **Every research methodology term explained** (simplest → most complex)
- **Complete checklist walkthroughs** with rationale for each item
- **"Teach like a kid" approach** - assumes no prior knowledge
- **Tables** showing checklist items + why they matter + assessment
- **Color-coded formatting:**
  - 🔵 Blue boxes = Term explanations
  - 🟢 Green text = Teaching notes
  - 📋 Tables = Checklists with rationale
- **Password protected:** JC2025
- **Copy-paste disabled** for content protection

**Output:** `StudyTitle_Educational.pdf`

---

## Installation

### Python Dependencies

```bash
pip install -r src/lib/document-generators/requirements.txt
```

This installs:
- `python-docx` - Word document generation
- `reportlab` - PDF creation
- `PyPDF2` - PDF password protection
- `Pillow` - Image handling

---

## Usage

### TypeScript API

```typescript
import { generateDocuments, DocumentData, createEducationalSection } from './lib/document-generators/index.js';

// Prepare your data
const data: DocumentData = {
  title: 'Study Title',
  metadata: {
    authors: 'Smith J, et al.',
    journal: 'NEJM',
    year: '2023',
  },
  sections: [
    createEducationalSection(
      'Introduction',
      'Main content goes here...',
      {
        // Term explanations for PDF
        'Term1': 'Detailed explanation...',
        'Term2': 'Another explanation...',
      },
      [
        // Teaching notes for PDF
        'Why this matters...',
        'Clinical significance...',
      ],
      [
        // Checklist items for PDF
        {
          item: 'Checklist criterion',
          rationale: 'Why this matters',
          assessment: 'Present ✓',
        },
      ],
      tablesFiguresArray // Optional images
    ),
  ],
};

// Generate both documents
const result = await generateDocuments(data, './output');

if (result.success) {
  console.log('Gamma Doc:', result.gammaDocPath);
  console.log('Educational PDF:', result.comprehensivePdfPath);
}
```

### Simple Sections (Gamma Only)

If you only need basic sections for Gamma (no educational content):

```typescript
import { createSimpleSection } from './lib/document-generators/index.js';

const section = createSimpleSection(
  'Study Design',
  'This was a randomized controlled trial...',
  images // Optional
);
```

---

## Data Structure

### DocumentData

```typescript
{
  title: string;
  metadata?: {
    authors?: string;
    journal?: string;
    year?: string;
    doi?: string;
  };
  sections: DocumentSection[];
}
```

### DocumentSection

```typescript
{
  heading: string;           // Section title
  content: string;           // Main text content

  // Optional (for educational PDF)
  explanations?: {
    [term: string]: string;  // Term → Detailed explanation
  };
  teaching_notes?: string[]; // Teaching points
  checklist_items?: {
    item: string;            // Checklist criterion
    rationale: string;       // Why it matters
    assessment: string;      // Present/Absent/Unclear
  }[];

  // Optional images
  images?: {
    title: string;           // Figure title
    base64: string;          // Base64 encoded image
    explanation: string;     // What the image shows
  }[];
}
```

---

## Integration with Existing Code

### From Vision Extractor

```typescript
import { extractTablesAndFigures } from './lib/vision-extractor.js';
import { generateDocuments, tableFiguresToImageData } from './lib/document-generators/index.js';

// Extract images from PDF
const visionResult = await extractTablesAndFigures('paper.pdf');

// Use in document generation
const data = {
  title: 'My Study',
  sections: [
    {
      heading: 'Results',
      content: 'The primary outcome was...',
      images: tableFiguresToImageData(visionResult.tablesFigures),
    },
  ],
};

await generateDocuments(data, './output');
```

### From Markitdown Text

```typescript
import { extractPdfWithMarkItDown } from './lib/markitdown-ocr.js';

// Extract text
const markitdownResult = await extractPdfWithMarkItDown('paper.pdf');

// Use in document generation
const data = {
  title: 'My Study',
  sections: [
    {
      heading: 'Background',
      content: markitdownResult.markdown,
    },
  ],
};
```

---

## Output Files

Both documents are created in the specified output directory:

```
output/
├── StudyTitle_Gamma.docx              # For Gamma upload
└── StudyTitle_Educational.pdf         # For students (password: JC2025)
```

### Opening the PDF

The educational PDF is password-protected:
- **Password:** `JC2025`
- **Permissions:** Printing allowed, copy-paste disabled

---

## Examples

See `src/test-document-generators.ts` for a complete example with:
- Multiple sections
- Term explanations
- Teaching notes
- Checklist items
- Images

Run the test:
```bash
npx tsx src/test-document-generators.ts
```

---

## Design Philosophy

### Gamma Document
- **Goal:** Feed Gamma AI with clean, structured content
- **Audience:** Gamma's presentation generator
- **Style:** Clean, simple, minimal jargon
- **Format:** Headings + text + images

### Educational PDF
- **Goal:** Complete self-contained learning resource
- **Audience:** Medical students learning critical appraisal
- **Style:** "Teach like a kid" - explain everything
- **Format:** Rich formatting with color-coded explanations, tables, teaching notes

---

## Troubleshooting

### PDF Protection Issues

If PDF password protection fails:
- Ensure `PyPDF2>=3.0.0` is installed
- Check Python version (3.8+)

### Image Loading Errors

If images don't appear:
- Verify base64 strings are valid
- Check image format (PNG, JPEG supported)
- Ensure images aren't too large (>10MB)

### Unicode/Special Characters

Both generators use UTF-8 encoding and handle:
- International characters (é, ñ, etc.)
- Mathematical symbols (±, ≥, etc.)
- Greek letters (α, β, etc.)

---

## Future Enhancements

Potential additions:
- [ ] PPTX output (direct PowerPoint generation)
- [ ] HTML export with interactive checklists
- [ ] Customizable PDF themes/branding
- [ ] Automated figure extraction from images
- [ ] CONSORT diagram auto-generation

---

## License

MIT License - Part of Journal Club V2 project
