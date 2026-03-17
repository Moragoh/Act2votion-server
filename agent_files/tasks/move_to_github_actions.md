# Plan: Move to GitHub Actions + GitHub Pages Pipeline

## Motivation
Eliminate the need to host and maintain a running server. Instead, use GitHub Actions as a scheduled runner and GitHub Pages as free static hosting. The iOS client fetches a small JSON file from a static URL instead of querying a live API.

## New Architecture

```
GitHub Actions (daily cron)
  ├── 1. pdfFetcher  → downloads PDF from devotional website
  ├── 2. pdfConverter → converts PDF to raw pdf2json JSON
  ├── 3. pdfParser   → extracts structured DevotionalEntry[]
  └── 4. Deploy      → publishes JSON to GitHub Pages

GitHub Pages (static hosting)
  └── devotional.json  ← iOS widget/app fetches this URL
```

## What Already Exists
- `pdfFetcher.ts` — scrapes website, downloads PDF to `data/pdfs/`
- `pdfConverter.ts` — converts PDF to raw JSON in `data/converted/`
- `pdfParser.ts` — parses raw JSON into `DevotionalEntry[]` in `data/parsed/`
- 27 passing tests covering all three services

## What Needs to Be Built

### Step 1: Create a pipeline orchestrator script
**File:** `src/scripts/pipeline.ts`

A single script that runs the full pipeline end-to-end:
1. Call `downloadLatestPdf()` → get PDF path (downloaded to a temp location)
2. **Deduplication check:** Compute SHA-256 hash of the new PDF and compare it against the hashes of all existing PDFs in `data/pdfs/`. If a match is found, the PDF is unchanged — skip processing and go straight to step 6.
3. **Rotation:** If `data/pdfs/` already has 3 PDFs, delete the oldest one and its corresponding files in `data/converted/` and `data/parsed/` to make room.
4. Save the new PDF to `data/pdfs/`
5. Call `convertPdfToJson(pdfPath)` → then `parseConvertedJson(jsonPath)`
6. **Combine all parsed files:** Read every JSON file in `data/parsed/`, merge all `DevotionalEntry[]` arrays into one, deduplicate by date, and write the combined result to `public/devotional.json`

This script is what the GitHub Action will execute.

#### PDF storage & rotation rules
- Maximum of **3 PDFs** stored at any time across `data/pdfs/`, `data/converted/`, and `data/parsed/` (kept in sync)
- When a 4th unique PDF arrives, the **oldest** PDF (by filename/date) and its corresponding converted and parsed files are deleted
- "Different" is determined by **SHA-256 file hash** comparison
- If the new PDF matches an existing hash, no processing occurs — but the combined `devotional.json` is still rebuilt from existing parsed files

### Step 2: Add an npm script
**File:** `package.json`

Add a `"pipeline"` script:
```json
"scripts": {
  "test": "jest",
  "pipeline": "ts-node --project tsconfig.run.json src/scripts/pipeline.ts"
}
```

### Step 3: Create the GitHub Actions workflow
**File:** `.github/workflows/update-devotional.yml`

```yaml
name: Update Devotional Data

on:
  schedule:
    - cron: '0 10 * * *'   # Runs daily at 10:00 UTC (5:00 AM EST)
  workflow_dispatch:         # Allows manual trigger from GitHub UI

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run pipeline

      - name: Commit updated data files back to repo
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/
          git diff --cached --quiet || git commit -m "Update devotional data"
          git push

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

> **Note:** The `data/` directory is committed back to the repo so that PDFs, converted files, and parsed files persist across workflow runs. This enables the deduplication check and 3-PDF rotation to work correctly.

### Step 4: Set up GitHub Pages
1. Go to repo Settings → Pages
2. Set source to the `gh-pages` branch (created automatically by the deploy action)
3. The JSON will be available at: `https://<username>.github.io/<repo-name>/devotional.json`

### Step 5: Structure the public output for the client
**Directory:** `public/`

The pipeline script should write output that's optimized for the client:

```
public/
  └── devotional.json      # Full array of DevotionalEntry[]
```

The client can fetch the full file and filter by today's date locally. Since `devotional.json` combines entries from all stored PDFs (up to 3), the client gets a wide range of devotional data in a single small request.

## What Can Be Removed (after migration)
- The planned Express API (`src/api/`) — no longer needed
- The planned scheduler (`src/scheduler/`) — GitHub Actions replaces this
- The planned `src/index.ts` server entry point — not needed

## What Stays the Same
- `pdfFetcher.ts`, `pdfConverter.ts`, `pdfParser.ts` — untouched
- All existing tests — untouched
- `data/` directory structure — still used as intermediate storage during the pipeline run (now persisted across runs, with up to 3 PDFs retained)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Devotional website is down when the action runs | `workflow_dispatch` allows manual re-run; also, the previous JSON stays live on Pages until overwritten |
| PDF format changes break parsing | Tests catch this; GitHub Actions sends failure email notifications |
| GitHub Actions cron can be delayed up to 15 min | Acceptable — devotional content doesn't need to-the-minute freshness |
| Repo must be public for free Pages hosting (or use GitHub Pro) | If private, consider alternatives: Cloudflare Pages, Netlify, or Vercel (all have free tiers for static sites) |

## Implementation Order
1. Create `src/scripts/pipeline.ts`
2. Add `"pipeline"` npm script
3. Test locally with `npm run pipeline`
4. Create `.github/workflows/update-devotional.yml`
5. Push to GitHub and enable GitHub Pages
6. Verify the JSON is live at the Pages URL
7. Point the iOS client at the static URL
