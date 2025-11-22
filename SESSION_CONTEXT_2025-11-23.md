# Session Context - Journal Club Standalone
**Date:** 2025-11-23
**Time:** ~00:30 IST

---

## Project Overview
- **App:** Next.js web app for journal club presentation generation
- **URL:** https://journal-club-standalone.onrender.com
- **Repo:** https://github.com/nayanlc19/journal-club-standalone
- **Render Service ID:** srv-d4gpuqmmcj7s73bjbb40
- **Parent Project:** D:\Claude\Projects\Journal_Club_V2

---

## Current State
App is **LIVE** on Render with auto-deploy enabled.

---

## What Was Done This Session

### 1. Fixed UI Issues
- Authors truncated to first 2 + "et al."
- DOI fits in box (max-width 180px, truncate)

### 2. Fixed Generate API
- **Problem:** Was trying to shell out to Windows path `D:\Claude\Projects\Journal_Club_V2`
- **Solution:** Rewrote generate route to use APIs directly

### 3. Fixed Groq Model
- Changed from deprecated `llama-3.1-70b-versatile` to `openai/gpt-oss-120b`
- Added lazy initialization to avoid build-time errors

### 4. Added Gamma API Integration
- Sends markdown to Gamma API
- Creates PPT with zephyr theme
- UI shows PPT download link when ready

### 5. Gamma API Settings (Final)
```typescript
{
  inputText: markdown,
  textMode: 'preserve',
  format: 'presentation',
  numCards: 20,
  additionalInstructions: 'Add critical appraisal checklist compulsorily',
  textOptions: {
    amount: 'detailed',
    tone: 'educational',
    audience: 'medical postgraduate students'
  },
  imageOptions: { source: 'noImages' },  // saves 33% credits
  cardOptions: { dimensions: '16x9' },
  themeId: 'zephyr',
  exportAs: 'pptx'
}
```

### 6. Partially Fixed journal-club-core Imports
- Removed `.js` extensions from imports in several files
- Files fixed: full-pipeline.ts, orchestrator.ts, appraisal-to-document-transformer.ts, text-generator.ts, appraisal/index.ts, appraisal/casp-checklists.ts, appraisal/equator-compliance.ts, ppt/index.ts, ppt/presenton-client.ts
- **Note:** Presenton is ABANDONED - use Gamma API instead

---

## Environment Variables on Render
- `GROQ_API_KEY` - For AI text generation
- `GAMMA_API_KEY` - For PPT generation

---

## Current Flow (Simplified - Abstract Only)

```
User enters DOI
       ↓
   CrossRef API (fetch title, authors, abstract)
       ↓
   Groq API (openai/gpt-oss-120b)
   (generate 8-section critical appraisal markdown)
       ↓
   Gamma API (zephyr theme, 60 credits)
   (convert markdown → PPT)
       ↓
   UI shows:
   - Gamma Markdown (copy button)
   - PPT download link
```

---

## Intended Full Flow (To Be Implemented)

```
User enters DOI/URL
       ↓
   PDF Fetch (Sci-Hub, Semantic Scholar, etc.)
       ↓
   OCR/Text Extraction (MarkItDown/Mistral)
   (full paper text - NO image extraction needed)
       ↓
   Critical Appraisal Generation (Groq)
   - Study Type Detection (hybrid keyword + AI)
   - CASP Checklist
   - ROB2 Assessment (for RCTs)
   - EQUATOR Compliance (CONSORT/STROBE/PRISMA)
   - 14 sections (Gamma) / 12 sections (Educational)
       ↓
   Gamma API → PPT (60 credits, zephyr theme)
       ↓
   Educational Word Doc (python-docx)
       ↓
   [FUTURE] Payment Page
       ↓
   [FUTURE] Supabase Storage (PPT + Word)
       ↓
   [FUTURE] Email with download links
       ↓
   [FUTURE] Auto-delete after 48 hours
```

**Note:** No image/figure extraction needed - Gamma API doesn't accept custom images.

---

## Gamma File Headings (14 sections)
1. Paper Basics
2. Study Design
3. Historical Context and Impact
4. Critical Appraisal Checklist
5. Results
6. Tables and Figures
7. Critical Analysis
8. Strengths
9. Weaknesses
10. Study Impact
11. Clinical Implications
12. Funding and Conflict of Interest
13. Related Research from the Web
14. Executive Summary

---

## Educational File Headings (12 sections)
1. Paper Basics
2. Executive Summary
3. Study Design
4. Historical Context & Impact
5. Critical Appraisal Checklist
6. Methods (How They Did It)
7. Results Interpretation (Simple Language)
8. Tables and Figures
9. Strengths & Limitations
10. Study Impact
11. Clinical Implications
12. Defense Questions & Answers
13. Funding or Conflict of Interest
14. Related Research from Web

---

## Gamma API Options Reference

### textMode
- `generate` - Rewrite and expand
- `condense` - Summarize
- `preserve` - Keep exact text ← **we use this**

### format
- `presentation` ← **we use this**
- `document`
- `social`
- `webpage`

### textOptions.amount
- `brief`
- `medium` (default)
- `detailed` ← **we use this**
- `extensive`

### textOptions.tone
- Free text (1-500 chars)
- We use: `educational`

### textOptions.audience
- Free text (1-500 chars)
- We use: `medical postgraduate students`

### imageOptions.source
- `noImages` ← **we use this (saves 33% credits)**
- `aiGenerated` (default, +20 credits)
- `pictographic`, `unsplash`, `giphy`, `webAllImages`, `placeholder`

### cardOptions.dimensions
- `16x9` ← **we use this**
- `4x3`, `1x1`, `4x5`, `9x16`, `fluid`

### additionalInstructions
- 1-2000 chars
- We use: `Add critical appraisal checklist compulsorily`

### numCards
- 1-60 (Pro) / 1-75 (Ultra)
- We use: `20`

### themeId
- `zephyr` ← **we use this**
- `consultant` (previous)

### exportAs
- `pptx` ← **we use this**
- `pdf`

---

## File Structure
```
app/
├── layout.tsx          # Space Grotesk + JetBrains Mono fonts
├── globals.css         # Dark theme, glass cards, animations
├── page.tsx            # Main UI with search, results, PPT download
└── api/
    ├── search/route.ts   # Paper search (CrossRef)
    ├── generate/route.ts # Critical appraisal + Gamma PPT
    ├── upload/route.ts   # PDF upload
    └── download/route.ts # File download

lib/
└── journal-club-core/   # Copied from parent project (imports partially fixed)
    ├── full-pipeline.ts
    ├── orchestrator.ts
    ├── text-generator.ts
    ├── gamma-api-client.ts
    ├── appraisal-to-document-transformer.ts
    ├── appraisal/
    │   ├── index.ts
    │   ├── study-type-detector.ts
    │   ├── casp-checklists.ts
    │   ├── rob2-assessment.ts
    │   └── equator-compliance.ts
    └── document-generators/
```

---

## Key Dependencies
- next: 16.0.3
- groq-sdk: AI text generation
- pdf-parse: PDF text extraction (CommonJS require)
- dotenv: Environment variables

---

## Recent Commits (This Session)
1. `0ecd5b5` - Add Gamma textOptions: detailed, educational, medical PG students + instructions
2. `29b84bd` - Change Gamma theme to zephyr
3. `fb06c6d` - UI: Add PPT download section when Gamma generates
4. `b6a125d` - Add Gamma API integration for PPT generation
5. `fc70dbf` - Fix: use openai/gpt-oss-120b model (same as parent project)
6. `436288d` - Fix: simplified generate API using Groq directly (no shell commands)
7. `4f23758` - Fix: truncate authors to 2 + et al, DOI fits in box

---

## Known Issues / TODOs

### Current Limitations
1. **Abstract-only generation** - Using CrossRef abstract instead of full PDF text
2. **Only 8 sections** - Should be 14 sections (Gamma) / 12 sections (Educational)
3. **No Educational Word doc** - Needs full pipeline with python-docx
4. **No PDF fetch** - Full pipeline needs Sci-Hub/Semantic Scholar integration

### To Implement Full Flow
1. Fix remaining `.js` imports in journal-club-core
2. Fix Groq lazy initialization in all files (text-generator.ts, casp-checklists.ts, etc.)
3. Integrate PDF fetch from orchestrator.ts
4. Integrate OCR extraction (MarkItDown)
5. Generate 14-section Gamma markdown
6. Generate Educational Word doc
7. Add payment page
8. Add Supabase storage
9. Add email notifications
10. Add 48-hour auto-delete

---

## User Preferences
- Concise answers, no unnecessary context
- No Presenton (abandoned) - use Gamma API
- Match parent project settings exactly
- Theme: zephyr (not consultant)

---

## Commands to Resume

```bash
# Navigate to project
cd D:\Claude\Projects\journal-club-standalone

# Local dev
npm run dev

# Build
npm run build

# Check deploy status
# Use Render MCP: mcp__render__list_deploys

# Parent project reference
cd D:\Claude\Projects\Journal_Club_V2
```

---

## API Keys Location
All API keys stored in `D:\Claude\APIkeys.md`
- GROQ_API_KEY
- GAMMA_API_KEY
- (others as needed)

---

**Session saved at:** 2025-11-23 00:30 IST
**Ready to resume:** Yes
**Next action:** Integrate full PDF pipeline or test current simplified flow
