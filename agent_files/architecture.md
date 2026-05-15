<overview>
Act2votion is a companion app for a daily devotional PDF. The PDF contains Bible verses and discussion questions organized by date. Users previously had to manually scroll to the current date — Act2votion surfaces the daily content automatically as an iOS widget.

This repository is the server component: it runs a daily automated pipeline that fetches the latest PDF, parses it, and publishes a static JSON file that the iOS widget reads.

There is no live server or HTTP API. The "backend" is entirely GitHub Actions + GitHub Pages.
</overview>

<tech-stack>
- **Runtime:** Node.js + TypeScript
- **Scheduling:** GitHub Actions — daily cron at 10:00 UTC (5:00 AM EST) plus manual `workflow_dispatch`
- **Web scraping:** axios + cheerio — fetches the devotional website and finds the latest PDF link
- **PDF parsing:** pdf2json — converts PDFs to structured JSON; custom parser extracts `DevotionalEntry[]`
- **Storage:** JSON files committed to the repo (`data/`) and published to GitHub Pages (`public/devotional.json`)
- **Client delivery:** GitHub Pages — iOS widget fetches `devotional.json` directly from the Pages URL
- **Testing:** Jest + ts-jest (27 unit tests, all offline with mocks)
</tech-stack>

<directory-structure>
- data/                        # Runtime artifacts committed to repo (auto-created by pipeline)
    - pdfs/                    # Up to 3 most recent downloaded PDFs, named by date (e.g. 2026-03-17.pdf)
    - converted/               # Raw pdf2json output, one JSON file per PDF
    - parsed/                  # Structured DevotionalEntry[] arrays, one JSON file per PDF
- public/                      # Pipeline output — deployed to gh-pages branch (gitignored on main)
    - devotional.json          # Combined, deduplicated, sorted entries; fetched by the iOS widget
- src/
    - services/
        - pdfFetcher.ts        # Scrapes website, downloads latest PDF to a temp file
        - pdfConverter.ts      # Converts a PDF to raw pdf2json JSON in data/converted/
        - pdfParser.ts         # Parses raw JSON into DevotionalEntry[], writes to data/parsed/
    - scripts/
        - pipeline.ts          # Full pipeline orchestrator — what GitHub Actions runs
        - runFetch.ts          # Manual one-shot script for the fetcher
        - runParser.ts         # Manual one-shot script for the parser
        - inspectPdf.ts        # Dumps raw pdf2json output to stdout for debugging
- .github/
    - workflows/
        - update-devotional.yml  # GitHub Actions: daily cron, runs pipeline, commits data/, deploys public/
- agent_files/                 # Agent/developer reference files (docs, lessons, architecture)
</directory-structure>
