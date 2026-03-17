# Act2votion Server — Documentation

## Overview

Act2votion is a companion server for a daily devotional PDF. The PDF contains Bible verses and discussion questions organized by date. The server's job is to automatically fetch the latest PDF from the devotional website, parse it, and serve today's verse and discussion questions via a REST API to an iOS widget.

This document describes what has been built so far.

---

## Project Structure

```
act2votion-server/
├── data/                        # Runtime artifacts (created automatically at runtime)
│   ├── pdfs/                    # Downloaded PDF files, named by date (e.g. 2026-03-17.pdf)
│   └── converted/               # Raw pdf2json output, one JSON file per PDF (e.g. 2026-03-17.json)
├── src/
│   ├── services/
│   │   ├── pdfFetcher.ts        # Scrapes website and downloads the latest PDF
│   │   └── pdfConverter.ts      # Converts a downloaded PDF to raw pdf2json JSON
│   └── scripts/
│       └── runFetch.ts          # One-shot manual test script for the PDF fetcher
├── agent_files/                 # Agent/developer reference files
├── jest.config.js
├── tsconfig.json                # Base TypeScript config (type-checking)
├── tsconfig.run.json            # TypeScript config for ts-node execution (CommonJS)
└── package.json
```

---

## What Has Been Built

### `src/services/pdfConverter.ts`

The PDF converter is responsible for turning a downloaded PDF file into raw structured JSON using `pdf2json`. It exports two functions:

#### `convertPdfToJson(pdfFilePath: string): Promise<string>`
The public entry point. Orchestrates the conversion pipeline:
1. Parse the PDF file into a raw `Output` object using `pdf2json`
2. Derive the output JSON file path from the PDF's base name
3. Write the JSON to `data/converted/`

Returns the path of the saved JSON file (e.g. `data/converted/2026-03-17.json`). This is the file the parser will consume in the next pipeline stage.

---

#### `buildConvertedJsonOutputPath(pdfFilePath: string): string`
Derives the output JSON path from the PDF input path: strips the `.pdf` extension, replaces it with `.json`, and places the file in `data/converted/`.

---

### `src/services/pdfFetcher.ts`

The PDF fetcher is responsible for the full pipeline of finding and downloading the latest devotional PDF. It exports five functions:

#### `downloadLatestPdf(): Promise<string>`
The public entry point. Orchestrates the full pipeline:
1. Scrape the devotional website for the PDF link
2. Convert the preview link to a direct download link
3. Build a date-based output file path
4. Download the PDF to disk

Returns the path of the saved file (e.g. `data/pdfs/2026-03-17.pdf`).

---

#### `scrapeLatestPdfUrl(websiteUrl: string): Promise<string>`
Uses `axios` to fetch the HTML of the devotional website and `cheerio` to find the first anchor tag whose `href` contains `.pdf`.

**Important:** The selector uses `a[href*=".pdf"]` (contains), not `a[href$=".pdf"]` (ends-with). The PDF links on this site are Dropbox URLs with query parameters appended after the `.pdf` extension (e.g. `file.pdf?rlkey=...&dl=0`), which would break an ends-with selector.

Throws an error if no PDF link is found on the page.

---

#### `buildDownloadableUrl(previewUrl: string): string`
The scraped Dropbox link is a preview link (`dl=0`). This function swaps `dl=0` for `dl=1`, which tells Dropbox to serve the raw file as a download instead of a browser preview.

---

#### `buildOutputFilePath(outputDir: string): string`
Derives the output filename from today's date in `YYYY-MM-DD` format (e.g. `2026-03-17.pdf`) and joins it with the given output directory. The output directory is `data/pdfs/` relative to the project root.

---

#### `downloadPdfToFile(downloadUrl: string, outputFilePath: string): Promise<void>`
Downloads the PDF as a binary stream using `axios` with `responseType: "stream"` and pipes it to a file using `fs.createWriteStream`. Creates the output directory if it does not already exist. Resolves when the write stream emits `finish`, or rejects on a stream error.

---

## Testing

### Automated Tests

Run the full test suite with:

```sh
npm test
```

Tests are in `src/__tests__/`. There are 8 unit tests across two test files, all of which run offline using mocks.

**`src/__tests__/pdfConverter.test.ts`** (3 tests)

| Test | What it verifies |
|---|---|
| `buildConvertedJsonOutputPath` | Returns a path in `data/converted/` with a `.json` extension matching the PDF base name |
| `convertPdfToJson` — success | Calls `mkdirSync` and `writeFileSync` with the correct paths and resolves with the output path |
| `convertPdfToJson` — parse error | Rejects when pdf2json emits `pdfParser_dataError` |

**Mocking strategy for `pdfConverter`:**
- `pdf2json` is mocked as a jest constructor; `loadPDF` uses `setImmediate` to emit `pdfParser_dataReady` asynchronously, matching real event-based behaviour
- `fs` is fully mocked — no files are written to disk

**`src/__tests__/pdfFetcher.test.ts`** (5 tests)

| Test | What it verifies |
|---|---|
| `scrapeLatestPdfUrl` — finds PDF link | Returns the correct `href` from a page with a PDF anchor tag |
| `scrapeLatestPdfUrl` — no PDF found | Throws an error when the page has no PDF link |
| `buildDownloadableUrl` | Correctly replaces `dl=0` with `dl=1` |
| `buildOutputFilePath` | Returns a `YYYY-MM-DD.pdf` path inside the given directory |
| `downloadPdfToFile` | Calls `mkdirSync` and `createWriteStream` with the correct arguments and resolves when the stream finishes |

**Mocking strategy for `pdfFetcher`:**
- `axios` is mocked via `jest.mock("axios")` — no real HTTP requests are made
- `fs` is mocked via `jest.mock("fs", ...)` with only `mkdirSync` and `createWriteStream` replaced — no real files are written
- Stream piping is tested using Node.js `PassThrough` streams; `setImmediate` is used to end the readable stream after the pipe is set up, which triggers the `finish` event on the write stream

---

### Manual End-to-End Test

To verify that the fetcher actually hits the website and saves a real PDF to disk:

**1. Run the fetch script:**

```sh
npx ts-node --project tsconfig.run.json src/scripts/runFetch.ts
```

**2. Expected console output:**

```
Fetching latest devotional PDF...
PDF saved to: /path/to/project/data/pdfs/2026-03-17.pdf
```

**3. Verify the file was saved:**

```sh
ls data/pdfs/
```

You should see a file named with today's date (e.g. `2026-03-17.pdf`). You can open it to confirm it is a valid, readable PDF.

**4. If it fails:**

Common failure reasons:
- **No PDF link found** — the website structure may have changed; inspect the page source and verify there is an anchor tag with `.pdf` in the `href`
- **Network error** — check your internet connection and that `https://devotions.acts2.network/` is reachable
- **Write error** — check that the project root directory is writable

---

## Dependencies

| Package | Purpose |
|---|---|
| `axios` | HTTP client — fetches the website HTML and downloads the PDF stream |
| `cheerio` | Server-side HTML parsing — finds the PDF anchor tag |
| `pdf2json` | PDF parsing — converts downloaded PDFs to structured JSON (`Output` type with `Meta` and `Pages[]`) |
| `ts-jest` | Runs TypeScript tests in Jest |
| `ts-node` | Runs TypeScript scripts directly (used for the manual test script) |

---

## What Comes Next

The following components are planned but not yet implemented:

- **`src/services/pdfParser.ts`** — reads the raw `data/converted/<date>.json` produced by the converter, extracts daily verses and discussion questions keyed by date, and writes structured JSON to `data/parsed/`
- **`src/scheduler/pdfUpdateJob.ts`** — daily cron job that calls the fetcher, checks if the PDF is new, triggers the converter, then the parser
- **`src/api/router.ts` and `src/api/devotionalController.ts`** — Express routes and controller to serve `GET /devotional/today` to the iOS widget
- **`src/index.ts`** — entry point that starts the Express server and registers the cron job
