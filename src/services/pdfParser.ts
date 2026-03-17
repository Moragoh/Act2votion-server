import * as fs from "fs";
import * as path from "path";
import type { Page, Text } from "pdf2json";

const PARSED_JSON_OUTPUT_DIR = path.join(process.cwd(), "data", "parsed");

export interface DevotionalEntry {
  date: string;
  type: "bible_text" | "memory_verse";
  verses: string;
  content: string;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function parseConvertedJson(jsonFilePath: string): Promise<string> {
  const rawJson = fs.readFileSync(jsonFilePath, "utf-8");
  const pdfData: { Pages: Page[] } = JSON.parse(rawJson);
  const entries = extractDevotionalEntries(pdfData.Pages);
  const outputPath = buildParsedOutputPath(jsonFilePath);
  writeParsedEntries(entries, outputPath);
  return outputPath;
}

export function buildParsedOutputPath(jsonFilePath: string): string {
  const baseName = path.basename(jsonFilePath);
  return path.join(PARSED_JSON_OUTPUT_DIR, baseName);
}

export function extractDevotionalEntries(pages: Page[]): DevotionalEntry[] {
  const entries: DevotionalEntry[] = [];
  const seenDates = new Set<string>();

  for (const page of pages) {
    const texts = deduplicateTextBlocks(page.Texts);
    const pageType = classifyPage(texts);
    if (pageType === "skip") continue;

    const entry =
      pageType === "bible_text"
        ? extractBibleTextEntry(texts)
        : extractMemoryVerseEntry(texts);

    if (!seenDates.has(entry.date)) {
      seenDates.add(entry.date);
      entries.push(entry);
    }
  }

  return entries;
}

// ─── Page Classification ──────────────────────────────────────────────────────

function classifyPage(texts: Text[]): "bible_text" | "memory_verse" | "skip" {
  if (isBlankPage(texts)) return "skip";
  if (!hasDateBlock(texts)) return "skip";
  if (isCommentaryPage(texts)) return "skip";
  if (hasBibleTextHeader(texts)) return "bible_text";
  if (hasMemoryVerseHeader(texts)) return "memory_verse";
  return "skip";
}

function isBlankPage(texts: Text[]): boolean {
  return texts.length === 0;
}

function hasDateBlock(texts: Text[]): boolean {
  return texts.some((text) => getFontSize(text) === 13);
}

function isCommentaryPage(texts: Text[]): boolean {
  return texts.some(
    (text) =>
      getFontSize(text) === 14 && getDecodedText(text).includes("Commentary on")
  );
}

function hasBibleTextHeader(texts: Text[]): boolean {
  return texts.some(
    (text) =>
      getFontSize(text) === 14 && getDecodedText(text).includes("Bible Text:")
  );
}

function hasMemoryVerseHeader(texts: Text[]): boolean {
  return texts.some(
    (text) =>
      getFontSize(text) === 14 && getDecodedText(text).includes("Memory Verse")
  );
}

// ─── Entry Extractors ─────────────────────────────────────────────────────────

function extractBibleTextEntry(texts: Text[]): DevotionalEntry {
  return {
    date: extractDate(texts),
    type: "bible_text",
    verses: extractBibleTextReference(texts),
    content: extractDiscussionQuestions(texts),
  };
}

function extractMemoryVerseEntry(texts: Text[]): DevotionalEntry {
  return {
    date: extractDate(texts),
    type: "memory_verse",
    verses: extractMemoryVerseReference(texts),
    content: extractMemoryVerseText(texts),
  };
}

// ─── Field Extractors ─────────────────────────────────────────────────────────

function extractDate(texts: Text[]): string {
  const dateBlock = texts.find((text) => getFontSize(text) === 13);
  if (!dateBlock) return "";
  return formatDateToIso(getDecodedText(dateBlock));
}

function extractBibleTextReference(texts: Text[]): string {
  const headerBlock = texts.find(
    (text) =>
      getFontSize(text) === 14 && getDecodedText(text).includes("Bible Text:")
  );
  if (!headerBlock) return "";
  return getDecodedText(headerBlock)
    .replace(/^Bible Text:\s*/, "")
    .trim();
}

function extractMemoryVerseReference(texts: Text[]): string {
  const headerIndex = texts.findIndex(
    (text) =>
      getFontSize(text) === 14 && getDecodedText(text).includes("Memory Verse")
  );
  if (headerIndex === -1) return "";

  for (let i = headerIndex + 1; i < texts.length; i++) {
    const text = texts[i];
    if (!text) continue;
    if (getFontSize(text) === 12 && isBibleReference(getDecodedText(text))) {
      return getDecodedText(text).trim();
    }
  }
  return "";
}

function extractDiscussionQuestions(texts: Text[]): string {
  const headerIndex = texts.findIndex(
    (text) =>
      getFontSize(text) === 14 && getDecodedText(text).includes("Bible Text:")
  );
  if (headerIndex === -1) return "";

  const lines: string[] = [];
  let currentQuestion = "";

  for (let i = headerIndex + 1; i < texts.length; i++) {
    const text = texts[i];
    if (!text) continue;
    const fontSize = getFontSize(text);
    const decoded = getDecodedText(text);

    if (fontSize === 11) break;

    if (isVerseSubHeader(text)) {
      if (currentQuestion.trim()) lines.push(currentQuestion.trim());
      currentQuestion = "";
      lines.push(decoded.trim());
      continue;
    }

    if (isBulletMarker(text)) {
      if (currentQuestion.trim()) lines.push(currentQuestion.trim());
      currentQuestion = "• ";
      continue;
    }

    if (isQuestionText(text)) {
      currentQuestion += decoded;
      continue;
    }
  }

  if (currentQuestion.trim()) lines.push(currentQuestion.trim());
  return lines.join("\n");
}

function extractMemoryVerseText(texts: Text[]): string {
  const referenceIndex = findMemoryVerseReferenceIndex(texts);
  if (referenceIndex === -1) return "";

  const verseParts: string[] = [];
  for (let i = referenceIndex + 1; i < texts.length; i++) {
    const text = texts[i];
    if (!text) continue;
    if (getFontSize(text) === 11) break;
    if (getFontSize(text) === 12) {
      verseParts.push(getDecodedText(text).trim());
    }
  }
  return verseParts.join(" ");
}

function findMemoryVerseReferenceIndex(texts: Text[]): number {
  const headerIndex = texts.findIndex(
    (text) =>
      getFontSize(text) === 14 && getDecodedText(text).includes("Memory Verse")
  );
  if (headerIndex === -1) return -1;

  for (let i = headerIndex + 1; i < texts.length; i++) {
    const text = texts[i];
    if (!text) continue;
    if (getFontSize(text) === 12 && isBibleReference(getDecodedText(text))) {
      return i;
    }
  }
  return -1;
}

// ─── Block Classifiers ────────────────────────────────────────────────────────

function isVerseSubHeader(text: Text): boolean {
  return (
    getFontSize(text) === 12 &&
    Math.abs(text.x - 2.0) < 0.1 &&
    isBibleReference(getDecodedText(text))
  );
}

function isBulletMarker(text: Text): boolean {
  const decoded = getDecodedText(text);
  return getFontSize(text) === 15 && (decoded === "•" || decoded === "*");
}

function isQuestionText(text: Text): boolean {
  return getFontSize(text) === 12 && text.x > 2.5;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateTextBlocks(texts: Text[]): Text[] {
  const blocksByPosition = new Map<string, Text>();

  for (const text of texts) {
    const key = `${text.x},${text.y}`;
    const existing = blocksByPosition.get(key);

    if (!existing) {
      blocksByPosition.set(key, text);
    } else if (getFontSize(existing) === null && getFontSize(text) !== null) {
      blocksByPosition.set(key, text);
    }
  }

  return Array.from(blocksByPosition.values());
}

// ─── Primitive Helpers ────────────────────────────────────────────────────────

export function getFontSize(text: Text): number | null {
  const run = text.R[0];
  if (!run) return null;
  // TS[1] is typed as number in the tuple but can be null at runtime for duplicate blocks
  return (run.TS[1] as number | null);
}

export function getDecodedText(text: Text): string {
  const run = text.R[0];
  if (!run) return "";
  return decodeURIComponent(run.T);
}

export function isBibleReference(text: string): boolean {
  return /^\d?\s?[A-Z][a-z]+\s+\d+[:\d\-–]*(\s+\([A-Z]+\))?/.test(
    text.trim()
  );
}

export function formatDateToIso(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function writeParsedEntries(entries: DevotionalEntry[], outputPath: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2), "utf-8");
}
