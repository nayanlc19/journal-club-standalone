# Session Context - Journal Club Standalone
**Date:** 2025-11-23
**Time:** ~11:30 IST

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

### 1. Added PDF Upload Processing
- PDF upload now extracts full text using `pdf-parse`
- Full paper text sent to Groq for better appraisal generation
- Supports both DOI (abstract only) and PDF upload (full text) paths

### 2. Security & Code Quality Fixes (Code Review)
Applied fixes based on Qodo Merge-style code review:

| Issue | Fix |
|-------|-----|
| 🔴 Path traversal vulnerability | Validate resolved path within `uploads/` dir |
| 🔴 No file size limit | Added 50MB max file size |
| 🔴 Files not cleaned up | `finally` block deletes PDF after processing |
| 🟡 Inconsistent HTTP client | Replaced axios with native fetch |
| 🟡 Prompt injection risk | `sanitizeContent()` escapes role markers |
| 🟡 Silent Gamma timeout | Throws proper error after 120s |
| 🟢 Duplicate DOI regex | Exported `DOI_REGEX` from generate route |
| 🟢 Missing parser cleanup | Added `parser.destroy()` |

### 3. Removed axios Dependency
- Replaced with native fetch + AbortController for timeouts
- Cleaner, no external dependency

---

## CRITICAL: Intended Flow (User Clarified)

**User does NOT get PPT immediately on the page.**

```
User logs in (Google OAuth) OR pays (Razorpay → email captured)
       ↓
   User enters DOI / uploads PDF
       ↓
   Background processing:
   - Gamma API → PPT (zephyr theme, 60 credits)
   - docx → Educational Word doc
       ↓
   Store both in Supabase Storage
       ↓
   Send email via Resend with download links
       ↓
   Auto-delete files after 48 hours
```

### Important Notes:
- **Google OAuth + Razorpay** will be added LATER when integrating into `smartdnbprep.onrender.com`
- For NOW (standalone): Add email input field on page
- **Remove** "Copy to Clipboard" and "Open Gamma" buttons (not requested)
- Show "We'll email you the download links" message instead

---

## Environment Variables on Render (Current)
- `GROQ_API_KEY` - For AI text generation
- `GAMMA_API_KEY` - For PPT generation

## Environment Variables Needed (Future)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `RESEND_API_KEY` - Resend email API key

---

## Current Generate Flow (What's Built)

```
User enters DOI or uploads PDF
       ↓
   CrossRef API (if DOI) / pdf-parse (if PDF)
       ↓
   Groq API (openai/gpt-oss-120b)
   - 8-section critical appraisal markdown
       ↓
   Gamma API (zephyr theme, 60 credits)
   - Convert markdown → PPT
       ↓
   UI shows:
   - Gamma Markdown (copy button) ← REMOVE THIS
   - PPT download link (if Gamma succeeded)
   - Open Gamma link ← REMOVE THIS
```

---

## Intended Full Flow (To Be Implemented)

### Phase 1: Email-based Delivery (Next)
1. Add email input field (before Generate button)
2. Remove "Copy to Clipboard" / "Open Gamma" buttons
3. Integrate Supabase Storage (bucket with 48h expiry)
4. Integrate Resend for email
5. Generate Educational Word doc (using `docx` npm package)
6. Send email with both download links

### Phase 2: Integration with smartdnbprep (Later)
1. Google OAuth (email from login)
2. Razorpay payment (email from payment)
3. Merge into smartdnbprep.onrender.com

### Phase 3: Full Pipeline (Future)
1. PDF fetch (Sci-Hub, Semantic Scholar, etc.)
2. MarkItDown OCR (includes tables/figures as text)
3. 14-section Gamma markdown (not 8)
4. 12-section Educational Word doc
5. Study type detection (hybrid keyword + AI)
6. CASP Checklist, ROB2 Assessment, EQUATOR Compliance

---

## Gamma File Headings (14 sections - Target)
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

## Educational File Headings (12 sections - Target)
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

## Gamma API Settings (Final - Confirmed)
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

---

## File Structure (Current)
```
app/
├── layout.tsx          # Space Grotesk + JetBrains Mono fonts
├── globals.css         # Dark theme, glass cards, animations
├── page.tsx            # Main UI with search, results, PPT download
└── api/
    ├── search/route.ts   # Paper search (CrossRef, URL scraping)
    ├── generate/route.ts # Critical appraisal + Gamma PPT
    ├── upload/route.ts   # PDF upload (50MB limit, path validation)
    └── download/route.ts # File download

lib/
└── journal-club-core/   # Copied from parent project (partially used)
```

---

## Key Code: generate/route.ts

### Security Functions Added:
```typescript
// Shared DOI regex
export const DOI_REGEX = /^10\.\d{4,}/;

// Path validation
const resolvedPath = path.resolve(filePath);
if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
  throw new Error('Invalid file path');
}

// Content sanitization (prevent prompt injection)
function sanitizeContent(text: string, maxLength: number = 30000): string {
  return text
    .substring(0, maxLength)
    .replace(/```/g, '~~~')
    .replace(/\*\*\s*(system|assistant|user)\s*:/gi, '$1:')
    .trim();
}

// File cleanup
async function cleanupFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
```

### Parser cleanup:
```typescript
const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
try {
  const textResult = await parser.getText();
  // ...
} finally {
  await parser.destroy().catch(() => {});
}
```

---

## Key Dependencies
- next: 16.0.3
- groq-sdk: AI text generation
- pdf-parse: PDF text extraction
- dotenv: Environment variables
- ~~axios~~: REMOVED - using native fetch

---

## Recent Commits (This Session)
1. `c9e5644` - Security and code quality fixes
2. `65d6299` - Add PDF upload processing to generate route
3. `9414f57` - Update context: MarkItDown includes tables/figures, Supabase+email before payment

---

## API Keys Location
All API keys stored in `D:\Claude\APIkeys.md`
- GROQ_API_KEY
- GAMMA_API_KEY
- SUPABASE_URL (to be added)
- SUPABASE_SERVICE_KEY (to be added)
- RESEND_API_KEY (to be added)

---

## User Preferences
- Concise answers, no unnecessary context
- No Presenton (abandoned) - use Gamma API
- Match parent project settings exactly
- Theme: zephyr (not consultant)
- Email service: Resend
- Auth: Google OAuth + Razorpay (LATER, when merging to smartdnbprep)

---

## Pending Tasks (Priority Order)

### Immediate (This App)
1. ❌ Remove "Copy to Clipboard" button
2. ❌ Remove "Open Gamma" link
3. ❌ Add email input field
4. ❌ Integrate Supabase Storage
5. ❌ Integrate Resend email
6. ❌ Generate Educational Word doc (using `docx` npm)
7. ❌ Show "Check your email" message instead of download links

### Later (Integration with smartdnbprep)
8. ❌ Google OAuth integration
9. ❌ Razorpay payment integration
10. ❌ Merge into smartdnbprep.onrender.com

### Future (Full Pipeline)
11. ❌ PDF fetch (Sci-Hub, Semantic Scholar)
12. ❌ MarkItDown OCR
13. ❌ 14-section Gamma markdown
14. ❌ Study type detection
15. ❌ CASP/ROB2/EQUATOR compliance

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
# Use Render MCP: mcp__render__list_deploys with serviceId: srv-d4gpuqmmcj7s73bjbb40

# Parent project reference
cd D:\Claude\Projects\Journal_Club_V2
```

---

**Session saved at:** 2025-11-23 11:30 IST
**Ready to resume:** Yes
**Next action:** Implement email-based delivery (Supabase + Resend)
