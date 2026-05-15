# How the GitHub Actions Pipeline Works

This document traces the full journey from the scheduled cron trigger to the JSON file being live on GitHub Pages.

---

## Step 1: The Cron Trigger

```yaml
on:
  schedule:
    - cron: '0 10 * * *'
  workflow_dispatch:
```

GitHub has its own internal scheduler. Every day at 10:00 UTC (5:00 AM EST), GitHub reads this cron expression and automatically queues a run of this workflow. No external server or process is needed to kick it off — GitHub does it entirely on its own.

`workflow_dispatch` adds a second trigger: a manual "Run workflow" button in the GitHub Actions UI, which is useful for testing or re-running after a failure.

---

## Step 2: Checkout the Repo

```yaml
- uses: actions/checkout@v4
```

GitHub spins up a fresh Ubuntu virtual machine for each workflow run. It starts completely empty — no files, no history. This step clones your repository onto that machine, including the `data/` folder (which contains the previously downloaded PDFs and parsed JSON files, committed back to main on prior runs). This is what makes deduplication and rotation work across runs.

---

## Step 3: Install Node.js

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

Installs Node.js 20 on the VM. The `cache: 'npm'` option caches the `node_modules` folder between runs so that `npm ci` is faster on subsequent runs (it skips re-downloading packages that haven't changed).

---

## Step 4: Install Dependencies

```yaml
- run: npm ci
```

Installs all packages listed in `package.json` (`axios`, `cheerio`, `pdf2json`, `ts-node`, etc.). `npm ci` is used instead of `npm install` because it installs exactly what is in the lockfile — deterministic and faster in CI environments.

---

## Step 5: Run the Pipeline

```yaml
- run: npm run pipeline
```

npm looks up `"pipeline"` in the `scripts` section of `package.json`:

```json
"pipeline": "ts-node --project tsconfig.run.json src/scripts/pipeline.ts"
```

`ts-node` compiles and runs `pipeline.ts` on the fly using `tsconfig.run.json`. The script does the following:

1. **Download** — scrapes `https://devotions.acts2.network/` for the latest PDF link, converts it to a direct download URL, and downloads the PDF to a temp file in `os.tmpdir()`
2. **Deduplicate** — computes a SHA-256 hash of the temp file and compares it against every PDF already in `data/pdfs/`. If it matches an existing file, the temp file is deleted and processing stops here.
3. **Rotate** — if `data/pdfs/` already has 3 PDFs and the new one is unique, deletes the oldest PDF and its corresponding files in `data/converted/` and `data/parsed/`
4. **Save** — copies the temp file to `data/pdfs/{today}.pdf`
5. **Convert & Parse** — converts the PDF to raw JSON (`data/converted/`), then extracts structured `DevotionalEntry[]` objects (`data/parsed/`)
6. **Combine** — reads all files in `data/parsed/`, merges and deduplicates by date, sorts chronologically, and writes the result to `public/devotional.json`

---

## Step 6: Commit `data/` Back to the Repo

```yaml
- name: Commit updated data files back to repo
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add data/
    git diff --cached --quiet || git commit -m "Update devotional data"
    git push
```

The VM has the repo checked out, so it can make git commits just like a developer would. This step:

1. Configures git with a bot identity so commits are attributed to `github-actions[bot]`
2. Stages the `data/` folder (which now contains the new PDF, converted JSON, and parsed JSON)
3. `git diff --cached --quiet` checks whether anything actually changed. If the PDF was a duplicate and nothing was added, there is nothing to commit — this line prevents an empty commit
4. If there are changes, commits and pushes back to the `main` branch

This is critical: because the VM starts fresh on every run, the only way for the deduplication and rotation logic to work is if the previously downloaded files are committed to the repo and checked out at the start of the next run.

---

## Step 7: Deploy to GitHub Pages

```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./public
```

This step takes the contents of the `public/` folder (which contains `devotional.json`) and pushes it to a special branch called `gh-pages` in your repository.

- `github_token` is a secret that GitHub automatically injects into every workflow run — you don't need to create it. It gives the action permission to push to the repo.
- `peaceiris/actions-gh-pages@v4` is a pre-built action (someone else's reusable workflow step, published on the GitHub Actions marketplace) that handles the `gh-pages` branch commit and push for you.
- The `gh-pages` branch only contains the contents of `public/` — not your source code. It is created automatically on the first run.

---

## Step 8: GitHub Pages Serves the File

GitHub Pages watches the `gh-pages` branch. Whenever that branch is updated, GitHub rebuilds and serves its contents at:

```
https://<your-username>.github.io/<repo-name>/devotional.json
```

There is no server running. GitHub Pages is a static file host — it just serves whatever files are in the `gh-pages` branch directly over HTTPS. The iOS widget fetches this URL, gets the JSON, and filters locally for today's date.

---

## Summary

```
10:00 UTC every day
  │
  ▼
GitHub scheduler triggers the workflow
  │
  ▼
Fresh Ubuntu VM is provisioned
  │
  ▼
Repo is checked out (including data/ from previous runs)
  │
  ▼
Node.js installed, npm ci installs packages
  │
  ▼
npm run pipeline → ts-node → pipeline.ts
  ├── Download PDF to temp file
  ├── SHA-256 dedup check
  ├── Rotate oldest if at capacity
  ├── Convert + Parse
  └── Write public/devotional.json
  │
  ▼
data/ committed back to main (so next run can deduplicate)
  │
  ▼
public/ deployed to gh-pages branch
  │
  ▼
GitHub Pages serves devotional.json at static URL
  │
  ▼
iOS widget fetches JSON
```
