# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Act2votion is a server that automates fetching and parsing a daily devotional PDF, making the content available to an iOS widget. There is no live HTTP server — the entire "backend" is a GitHub Actions pipeline that publishes a static JSON file to GitHub Pages.

## Commands

```bash
# Run tests
npm test

# Run a single test file
npx jest src/__tests__/pdfParser.test.ts

# Run the full pipeline locally (download → convert → parse → publish)
npm run pipeline

# One-shot scripts for manual debugging
npx ts-node --project tsconfig.run.json src/scripts/runFetch.ts
npx ts-node --project tsconfig.run.json src/scripts/runParser.ts

# Inspect raw pdf2json output for a PDF file (useful when updating parse heuristics)
npx ts-node --project tsconfig.run.json src/scripts/inspectPdf.ts <path-to-pdf>
```

## Architecture

### Data Flow

```
devotions.acts2.network  →  pdfFetcher  →  data/pdfs/<date>.pdf
                                             ↓
                                         pdfConverter  →  data/converted/<date>.json
                                             ↓
                                         pdfParser  →  data/parsed/<date>.json
                                             ↓
                                         pipeline.ts  →  public/devotional.json
                                             ↓
                                         GitHub Pages  ←  iOS widget
```

### Key Source Files

- `src/scripts/pipeline.ts` — Orchestrates the full run. GitHub Actions executes `npm run pipeline` which calls this. Handles deduplication (SHA-256 hash check), rotation (keeps max 3 PDFs), and combines all parsed files into `public/devotional.json`.
- `src/services/pdfFetcher.ts` — Scrapes the devotional website (axios + cheerio) to find the latest PDF link, converts Dropbox preview URLs to direct download URLs, and downloads to a temp file.
- `src/services/pdfConverter.ts` — Wraps pdf2json to convert a PDF to raw JSON in `data/converted/`.
- `src/services/pdfParser.ts` — Parses raw pdf2json output into `DevotionalEntry[]`. Contains all the heuristics for identifying page types and extracting fields based on font size and x/y coordinates.

### Core Data Type

```ts
interface DevotionalEntry {
  date: string;       // ISO date: "2026-03-17"
  type: "bible_text" | "memory_verse";
  verses: string;     // e.g. "John 8:12-30 (ESV)"
  content: string;    // discussion questions or memory verse text
}
```

### TypeScript Configs

Two tsconfig files exist for a reason:
- `tsconfig.json` — strict config used by the IDE (uses `module: "nodenext"`, `verbatimModuleSyntax: true`)
- `tsconfig.run.json` — used by ts-node and ts-jest (uses `module: "commonjs"`, `esModuleInterop: true`, `verbatimModuleSyntax: false`); required because pdf2json is a CJS module

Jest's `ts-jest` transform overrides also set `verbatimModuleSyntax: false` and `esModuleInterop: true` — do not remove these.

### PDF Parse Heuristics (important when modifying pdfParser.ts)

Page classification is driven entirely by font size signals from pdf2json:

| Font size | Meaning |
|-----------|---------|
| 13 | Date header (`"Monday, January 19, 2026"`) — presence required for any daily page |
| 14 | Section headers: `"Bible Text: ..."`, `"Memory Verse"`, `"Commentary on ..."` |
| 15 | Bullet marker (`"•"`) preceding a discussion question |
| 12 | Verse sub-headers (x ≈ 2.0) or question/verse body text (x > 2.5) |
| 11 | Dot-fill journal lines — signals end of content; stop parsing when encountered |

Use `a[href*='.pdf']` (contains) not `$=` (ends-with) when scraping PDF links — Dropbox URLs append query parameters after `.pdf`.

### GitHub Actions

`.github/workflows/update-devotional.yml` runs daily at 10:00 UTC (5:00 AM EST). On completion it commits `data/` back to `main` and deploys `public/` to the `gh-pages` branch via `peaceiris/actions-gh-pages`. The `public/` directory is gitignored on `main`.

## Agent Reference Files

Extended docs live in `agent_files/`:
- `architecture.md` — detailed architecture with directory structure
- `overview.md` — product overview and goals
- `lessons.md` — hard-won parsing lessons (read before touching pdfParser.ts or pdfFetcher.ts)
- `documentation.md` — API/output format docs
