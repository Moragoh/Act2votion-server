# Lessons Learned

## CSS selector for PDF links must use `*=` (contains), not `$=` (ends-with)

When scraping Dropbox-hosted PDF links, the `href` looks like:
```
https://www.dropbox.com/scl/fi/.../file.pdf?rlkey=...&dl=0
```
The `.pdf` appears in the middle, not at the end. Using `a[href$='.pdf']` (ends-with) finds nothing.

**Rule:** Always use `a[href*='.pdf']` (contains) when scraping PDF links from pages that may add query parameters.

---

## pdf2json needs `esModuleInterop: true` in CJS context

pdf2json exports itself as `module.exports = PDFParser` (a plain CJS export). When TypeScript compiles `import PDFParser from "pdf2json"` to CommonJS without `esModuleInterop`, it generates `pdf2json_1.default` — which is `undefined`.

**Rule:** When importing CJS packages that use `module.exports = X` as a default import in TypeScript, ensure `esModuleInterop: true` is set — especially in the ts-jest tsconfig override.

---

## The first page of a PDF may have no text blocks

When writing tests that assert text content exists, do not assume `Pages[0].Texts.length > 0`. The first page may be a cover page or image-only.

**Rule:** Assert text exists across all pages combined (`Pages.reduce(sum + page.Texts.length, 0) > 0`) rather than on a specific page index.

---

## ts-jest requires `verbatimModuleSyntax: false`

The root `tsconfig.json` has `verbatimModuleSyntax: true`, which conflicts with how ts-jest transforms imports. Jest tests will fail to compile with it enabled.

**Rule:** Override `verbatimModuleSyntax: false` in the ts-jest tsconfig override inside `jest.config.js`.

---

## DT PDF structure observations (for extraction heuristics)

Inspected via pdf2json on a real devotional PDF. Each `Text` block has: `x`, `y`, `R[0].T` (the text), and `R[0].TS` (a 4-tuple where index 1 is font size).

**Page types and how to identify them:**

| Page type | Identifying signal |
|---|---|
| Cover / front matter | `Texts` is empty, or contains no date header |
| Memory verses | No date header; contains Bible references and verse text |
| Commentary | Date header present; no `"Bible Text:"` header; dense prose body |
| **Discussion question page** | Date header present **and** `"Bible Text:"` header present |
| Journal (blank lines) | Date header present; body consists entirely of `"....."` dot-fill text blocks |

**Discussion question page — field locations and font signals:**

- **Date header** — `y ≈ 1.27`, font size `13`, format: `"Monday, January 19, 2026"`. This is the canonical date signal for a daily page.
- **Bible text header** — `y ≈ 2.60–2.67`, font size `14`, format: `"Bible Text: John 8:12-30 (ESV)"`. Presence of this header distinguishes a discussion question page from a commentary or journal page.
- **Verse section sub-header** — font size `12`, `x ≈ 2.00`, text is a Bible reference like `"John 8:12-13"`. Groups the questions that follow under a specific passage.
- **Bullet marker** — font size `15`, text is `"•"`. Immediately precedes a discussion question.
- **Question text** — font size `12`, `x ≈ 3.12` (indented). The text block immediately following a bullet marker at the same `y` value, or on the next line(s) at the same `x`.
- **Dot-fill lines** — font size `11`, text is a long string of `"."` characters. These are journal writing lines — skip them entirely.

**Multi-line text handling:**

pdf2json breaks wrapped lines into separate `Text` blocks at the same `x` but incrementing `y` (step ≈ `0.675`). To reconstruct a full question, concatenate all consecutive text blocks at `x ≈ 3.12` until the next bullet marker or section sub-header is encountered.

**Date parsing:**

The date string uses full weekday and month names: `"Monday, January 19, 2026"`. Parse with `new Date(dateString)` or a regex — do not rely on the PDF filename date, as the scheduler names files by download date which may differ from the devotional date range inside.
