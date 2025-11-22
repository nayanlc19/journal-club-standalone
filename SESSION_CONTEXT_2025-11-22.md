# Session Context - Journal Club Standalone
**Date:** 2025-11-22
**Time:** ~20:00 IST

## Project Overview
A Next.js web app that generates journal club presentation materials from research papers.
- **URL:** https://journal-club-standalone.onrender.com
- **Repo:** https://github.com/nayanlc19/journal-club-standalone
- **Render Service ID:** srv-d4gpuqmmcj7s73bjbb40

## Current State
App is **LIVE** and deployed on Render with auto-deploy enabled.

## What Was Done Today

### 1. Initial Deployment Fix
- Fixed missing `pdf-parse` dependency
- Changed import from ESM to CommonJS: `const pdf = require('pdf-parse')`
- Added `dotenv` dependency

### 2. PDF Upload Feature
- Added drag & drop PDF upload with progress bar (TQDM-style)
- Created `/api/upload` endpoint for file handling
- Shows upload percentage and success message
- Files saved to `uploads/` directory

### 3. Complete UI Redesign (Claude Frontend Design Skill)
Applied design principles from claude.com/blog/improving-frontend-design-through-skills:
- **Typography:** Space Grotesk (display) + JetBrains Mono (code)
- **Colors:** Dark theme with teal/cyan dominant + orange accents
- **Cards:** Glass morphism with blur + subtle borders
- **Background:** Animated gradient with depth (radial gradients)
- **Animations:** Staggered fade-in on page load
- **Buttons:** Gradient fills with hover glow effects
- **Progress bar:** Styled with gradient fill

### 4. Instructional Content
Added comprehensive help section with:
- DOI explanation (what it is, where to find it)
- 3 DOI examples with journal labels (NEJM, Lancet, JAMA)
- 3 Paper title search examples
- 5 Open Access URLs (JAPI, PMC, MDPI, BMC, PLOS)
- All examples are clickable to auto-fill search box

### 5. UX Flow Improvements
- **Paper Found appears ABOVE PDF upload** (no scrolling needed)
- Help section & PDF upload hide when paper is found
- "Search different paper" button to reset
- Everything visible in single viewport

## File Structure
```
app/
├── layout.tsx          # Space Grotesk + JetBrains Mono fonts
├── globals.css         # Dark theme, glass cards, animations
├── page.tsx            # Main UI with search, upload, results
└── api/
    ├── search/route.ts   # Paper search API
    ├── generate/route.ts # Document generation API
    ├── upload/route.ts   # PDF upload API (NEW)
    └── download/route.ts # File download API

lib/
└── journal-club-core/
    ├── simple-pdf-extractor.ts  # pdf-parse integration
    ├── vision-extractor.ts      # Groq vision extraction
    └── ... other modules
```

## Key Dependencies
- next: 16.0.3
- pdf-parse: for PDF text extraction
- dotenv: environment variables
- groq-sdk: AI analysis

## CSS Classes (globals.css)
- `.bg-animated` - Animated gradient background
- `.glass-card` - Glass morphism card with blur
- `.btn-accent` - Teal gradient button with glow
- `.btn-warm` - Orange gradient button with glow
- `.input-modern` - Dark input with teal focus
- `.upload-zone` - Drag & drop area styling
- `.progress-bar` / `.progress-bar-fill` - Upload progress
- `.mono` - JetBrains Mono font
- `.animate-fade-in-up` - Staggered animation

## Environment Variables Needed
- `GROQ_API_KEY` - For AI analysis

## Next Steps (If Continuing)
1. Test PDF upload end-to-end on production
2. Handle uploaded PDF in generate API
3. Add file size limits to upload
4. Consider adding preview of uploaded PDF
5. Error handling improvements

## Recent Commits
1. `422e482` - Paper Found appears above PDF upload, no scrolling
2. `8e71552` - Fix: Paper Found appears in same card
3. `d95dffa` - Restore rich instructional content with examples
4. `16f4865` - Complete UI redesign with modern dark theme
5. `983a42a` - Add PDF upload with progress bar
6. `3c8f92d` - Fix pdf-parse import and add dependencies
7. `e8fd89a` - Add pdf-parse dependency

## User Preferences Noted
- Prefers concise, to-the-point answers
- Doesn't want unnecessary context repetition
- Wants visible UI without scrolling
- Values educational/instructional content for users
