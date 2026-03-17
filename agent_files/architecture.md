<overview>
This is the server for Act2votion, a companion app for a devotional text pdf.

A devotional pdf has verses for a weekday followed by some discussion questions pertaining to the date. Currently, people who use this pdf to read the Bible and reflect on it daily have to scroll down to the current date in the pdf to know what the current verse is.

Act2votion addresses this pain point: it is a widget that automatically fetches what the day's text and discussion text is and displays it.

Again, this repository is only for the server component, which is in charge of automatically updating to new pdfs and parsing them.
</overview>

<tech-stack>
- **Runtime:** Node.js + TypeScript
- **Web framework:** Express.js — serves HTTP endpoints that the iOS widget/app calls (e.g., `GET /devotional/today`)
- **Scheduling:** node-cron — runs a daily in-process job to check if a new PDF has been uploaded
- **Web scraping:** axios + cheerio — fetches the devotional website and finds the latest PDF link
- **PDF parsing:** pdf2json — parses downloaded PDFs into structured text
- **Storage:** JSON file — flat file keyed by date storing verses and discussion questions; writes are rare (only on new PDF), reads are simple date lookups
- **Testing:** Jest + ts-jest
</tech-stack>

<directory-structure>
This is a loose directory structure. Refer to it, but you don't have to follow it strictly if you think there is a better way

- data/                        # Runtime artifacts — lives at project root, NOT inside src
    - pdfs/                    # Up to 3 most recent raw PDF files
    - parsed/                  # Corresponding parsed devotional JSON files (keyed by date)
- src/
    - index.ts                 # Entry point: starts Express server and registers cron job
    - scheduler/
        - pdfUpdateJob.ts      # Daily cron job: orchestrates fetch → parse → store pipeline; decides if downloaded PDF is new
    - services/
        - pdfFetcher.ts        # Scrapes the devotional website and downloads the latest PDF to data/pdfs/
        - pdfParser.ts         # Reads a raw PDF, extracts verses and discussion questions, writes to data/parsed/
    - api/
        - router.ts            # Express route definitions
        - devotionalController.ts  # Handles GET /devotional/today and other client-facing endpoints
</directory-structure>
