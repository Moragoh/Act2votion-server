# Act2votion Server — Documentation

## Overview

Act2votion is a companion server for a daily devotional PDF. The PDF contains Bible verses and discussion questions organized by date. The server's job is to automatically fetch the latest PDF from the devotional website, parse it, and publish a static JSON file to GitHub Pages that an iOS widget consumes.

---

## Architecture

```
GitHub Actions (daily cron at 10:00 UTC / 5:00 AM EST)
  ├── 1. pdfFetcher  → downloads PDF to temp, deduplicates by SHA-256
  ├── 2. pdfConverter → converts PDF to raw pdf2json JSON
  ├── 3. pdfParser   → extracts structured DevotionalEntry[]
  └── 4. Deploy      → publishes public/devotional.json to GitHub Pages

GitHub Pages (static hosting)
  └── devotional.json  ← iOS widget fetches this URL
```

---

## Project Structure

```
act2votion-server/
├── data/                        # Runtime artifacts committed to repo (created automatically)
│   ├── pdfs/                    # Up to 3 most recent downloaded PDFs, named by date (e.g. 2026-03-17.pdf)
│   ├── converted/               # Raw pdf2json output, one JSON file per PDF (e.g. 2026-03-17.json)
│   └── parsed/                  # Structured DevotionalEntry[] arrays, one JSON file per PDF
├── public/                      # Pipeline output (gitignored on main; deployed to gh-pages)
│   └── devotional.json          # Combined entries from all stored PDFs
├── src/
│   ├── services/
│   │   ├── pdfFetcher.ts        # Scrapes website and downloads the latest PDF
│   │   ├── pdfConverter.ts      # Converts a downloaded PDF to raw pdf2json JSON
│   │   └── pdfParser.ts         # Parses raw JSON into DevotionalEntry[]
│   └── scripts/
│       ├── pipeline.ts          # Full pipeline orchestrator — this is what GitHub Actions runs
│       ├── runFetch.ts          # One-shot manual test script for the PDF fetcher
│       ├── runParser.ts         # One-shot manual test script for the PDF parser
│       └── inspectPdf.ts        # Dumps raw pdf2json output to stdout for debugging
├── .github/
│   └── workflows/
│       └── update-devotional.yml # GitHub Actions workflow: daily cron + manual trigger
├── agent_files/                 # Agent/developer reference files
├── jest.config.js
├── tsconfig.json                # Base TypeScript config (type-checking)
├── tsconfig.run.json            # TypeScript config for ts-node execution (CommonJS)
└── package.json
```

---

## What Has Been Built

### `src/scripts/pipeline.ts`

The pipeline orchestrator. Run locally with `npm run pipeline` or automatically via GitHub Actions. Executes the full end-to-end pipeline:

1. **Download** — fetches the latest PDF from the devotional website to a temporary file in `os.tmpdir()`
2. **Deduplicate** — computes a SHA-256 hash of the downloaded PDF and compares it against every PDF in `data/pdfs/`. If a match is found, the temp file is deleted and processing is skipped.
3. **Rotate** — if `data/pdfs/` already contains 3 PDFs and the new one is unique, deletes the oldest PDF and its corresponding files in `data/converted/` and `data/parsed/` to make room.
4. **Save** — copies the temp file to `data/pdfs/{today}.pdf`
5. **Convert & Parse** — calls `convertPdfToJson` then `parseConvertedJson`
6. **Combine** — reads every file in `data/parsed/`, merges all `DevotionalEntry[]` arrays, deduplicates by date, sorts chronologically, and writes the result to `public/devotional.json`

---

### `src/services/pdfParser.ts`

Reads a raw `data/converted/<date>.json` file produced by the converter, extracts daily Bible text and memory verse entries keyed by date, and writes structured JSON to `data/parsed/`.

#### `parseConvertedJson(jsonFilePath: string): Promise<string>`
The public entry point. Reads the JSON file, runs `extractDevotionalEntries`, and writes the result to `data/parsed/`.

---

#### `extractDevotionalEntries(pages: Page[]): DevotionalEntry[]`
Iterates pages, classifies each page type, extracts the appropriate entry, and deduplicates by date. Returns a `DevotionalEntry[]`.

---

#### `DevotionalEntry` (interface)

```ts
interface DevotionalEntry {
  date: string;             // ISO date, e.g. "2026-03-17"
  type: "bible_text" | "memory_verse";
  verses: string;           // e.g. "John 8:12-30 (ESV)"
  content: string;          // discussion questions or memory verse text
}
```

---

#### Page classification heuristics

| Page type | Signal |
|---|---|
| Blank / cover | No `Text` blocks |
| Commentary | `font size 14` block containing `"Commentary on"` |
| Bible text (discussion questions) | Date block (`font size 13`) + `"Bible Text:"` block (`font size 14`) |
| Memory verse | Date block (`font size 13`) + `"Memory Verse"` block (`font size 14`) |
| Skip (journal, etc.) | Anything else |

---

### `src/services/pdfConverter.ts`

Converts a PDF file to raw structured JSON using `pdf2json`.

#### `convertPdfToJson(pdfFilePath: string): Promise<string>`
Parses the PDF via a `PDFParser` event emitter, writes the raw `Output` JSON to `data/converted/`, and returns the output path.

---

#### `buildConvertedJsonOutputPath(pdfFilePath: string): string`
Derives the output JSON path from the PDF's base name and places it in `data/converted/`.

---

### `src/services/pdfFetcher.ts`

Finds and downloads the latest devotional PDF.

#### `downloadLatestPdf(): Promise<string>`
Orchestrates the full pipeline: scrape → convert preview URL → build output path → download. Returns the saved file path.

---

#### `scrapeLatestPdfUrl(websiteUrl: string): Promise<string>`
Fetches the website HTML and finds the first anchor with `.pdf` in its `href` using the `a[href*=".pdf"]` selector (contains, not ends-with — the links have query parameters after `.pdf`).

---

#### `buildDownloadableUrl(previewUrl: string): string`
Swaps `dl=0` for `dl=1` in a Dropbox preview URL to get a direct download link.

---

#### `buildOutputFilePath(outputDir: string): string`
Returns `{outputDir}/{YYYY-MM-DD}.pdf` using today's date.

---

#### `downloadPdfToFile(downloadUrl: string, outputFilePath: string): Promise<void>`
Downloads the PDF as a binary stream and pipes it to disk. Creates the output directory if needed.

---

## GitHub Actions Workflow

**File:** `.github/workflows/update-devotional.yml`

Triggers:
- `schedule`: daily at 10:00 UTC (5:00 AM EST)
- `workflow_dispatch`: manual trigger from the GitHub UI

Steps:
1. Checkout main branch
2. `npm ci`
3. `npm run pipeline` — runs the full pipeline
4. Commits any changes to `data/` back to main (enables dedup and rotation to persist across runs)
5. Deploys `public/` to the `gh-pages` branch via `peaceiris/actions-gh-pages@v4`

The iOS client fetches the JSON from:
```
https://<username>.github.io/<repo-name>/devotional.json
```

To enable GitHub Pages: go to repo Settings → Pages → set source to the `gh-pages` branch.

---

## Testing

### Automated Tests

```sh
npm test
```

Tests are in `src/__tests__/`. There are 27 unit tests across three test files, all of which run offline using mocks.

**`src/__tests__/pdfFetcher.test.ts`** (5 tests)

| Test | What it verifies |
|---|---|
| `scrapeLatestPdfUrl` — finds PDF link | Returns the correct `href` from a page with a PDF anchor tag |
| `scrapeLatestPdfUrl` — no PDF found | Throws when no PDF link is present |
| `buildDownloadableUrl` | Replaces `dl=0` with `dl=1` |
| `buildOutputFilePath` | Returns a `YYYY-MM-DD.pdf` path inside the given directory |
| `downloadPdfToFile` | Calls `mkdirSync` and `createWriteStream` correctly and resolves on stream finish |

**`src/__tests__/pdfConverter.test.ts`** (3 tests)

| Test | What it verifies |
|---|---|
| `buildConvertedJsonOutputPath` | Returns a path in `data/converted/` with `.json` extension |
| `convertPdfToJson` — success | Writes JSON to disk and resolves with the output path |
| `convertPdfToJson` — parse error | Rejects when pdf2json emits `pdfParser_dataError` |

**`src/__tests__/pdfParser.test.ts`** (19 tests)

Covers page classification, date extraction, Bible text reference extraction, discussion question extraction, memory verse extraction, deduplication, and the `isBibleReference` / `formatDateToIso` helpers.

---

### Running the Pipeline Manually

```sh
npm run pipeline
```

Expected output (new PDF):
```
Starting devotional pipeline...
Saved new PDF: /path/to/project/data/pdfs/2026-03-17.pdf
Converted to JSON: /path/to/project/data/converted/2026-03-17.json
Parsed entries: /path/to/project/data/parsed/2026-03-17.json
Written N entries to public/devotional.json
Pipeline complete.
```

Expected output (unchanged PDF):
```
Starting devotional pipeline...
PDF unchanged — skipping conversion and parsing.
Written N entries to public/devotional.json
Pipeline complete.
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `axios` | HTTP client — fetches website HTML and downloads the PDF stream |
| `cheerio` | Server-side HTML parsing — finds the PDF anchor tag |
| `pdf2json` | PDF parsing — converts PDFs to structured JSON (`Output` type with `Meta` and `Pages[]`) |
| `ts-jest` | Runs TypeScript tests in Jest |
| `ts-node` | Runs TypeScript scripts directly |
