import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  scrapeLatestPdfUrl,
  buildDownloadableUrl,
  buildOutputFilePath,
  downloadPdfToFile,
} from "../services/pdfFetcher";
import { convertPdfToJson } from "../services/pdfConverter";
import { parseConvertedJson, type DevotionalEntry } from "../services/pdfParser";

const DEVOTIONAL_WEBSITE_URL = "https://devotions.acts2.network/";

const PDF_DIR = path.join(process.cwd(), "data", "pdfs");
const CONVERTED_DIR = path.join(process.cwd(), "data", "converted");
const PARSED_DIR = path.join(process.cwd(), "data", "parsed");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_STORED_PDFS = 3;

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Starting devotional pipeline...");

  const tempPdfPath = await downloadToTemp();
  const isDuplicate = isNewPdfDuplicate(tempPdfPath);

  if (isDuplicate) {
    console.log("PDF unchanged — skipping conversion and parsing.");
    fs.unlinkSync(tempPdfPath);
  } else {
    await processNewPdf(tempPdfPath);
  }

  buildCombinedDevotionalJson();
  console.log("Pipeline complete.");
}

// ─── Download ─────────────────────────────────────────────────────────────────

async function downloadToTemp(): Promise<string> {
  const previewUrl = await scrapeLatestPdfUrl(DEVOTIONAL_WEBSITE_URL);
  const downloadableUrl = buildDownloadableUrl(previewUrl);
  const tempPath = path.join(os.tmpdir(), `act2votion-temp-${Date.now()}.pdf`);
  await downloadPdfToFile(downloadableUrl, tempPath);
  return tempPath;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function isNewPdfDuplicate(tempPdfPath: string): boolean {
  const newHash = computeSha256(tempPdfPath);
  return listExistingPdfPaths().some(
    (existingPath) => computeSha256(existingPath) === newHash
  );
}

function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function listExistingPdfPaths(): string[] {
  if (!fs.existsSync(PDF_DIR)) return [];
  return fs
    .readdirSync(PDF_DIR)
    .filter((name) => name.endsWith(".pdf"))
    .sort()
    .map((name) => path.join(PDF_DIR, name));
}

// ─── New PDF Processing ───────────────────────────────────────────────────────

async function processNewPdf(tempPdfPath: string): Promise<void> {
  const finalPdfPath = buildOutputFilePath(PDF_DIR);
  const isOverwritingExistingFile = fs.existsSync(finalPdfPath);

  if (!isOverwritingExistingFile) {
    rotateOldestPdfIfAtCapacity();
  }

  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.copyFileSync(tempPdfPath, finalPdfPath);
  fs.unlinkSync(tempPdfPath);
  console.log(`Saved new PDF: ${finalPdfPath}`);

  const convertedJsonPath = await convertPdfToJson(finalPdfPath);
  console.log(`Converted to JSON: ${convertedJsonPath}`);

  const parsedJsonPath = await parseConvertedJson(convertedJsonPath);
  console.log(`Parsed entries: ${parsedJsonPath}`);
}

// ─── Rotation ─────────────────────────────────────────────────────────────────

function rotateOldestPdfIfAtCapacity(): void {
  const existingPdfPaths = listExistingPdfPaths();
  if (existingPdfPaths.length < MAX_STORED_PDFS) return;
  const oldestPdfPath = existingPdfPaths[0];
  if (!oldestPdfPath) return;
  deleteCorrespondingFiles(oldestPdfPath);
}

function deleteCorrespondingFiles(pdfPath: string): void {
  const baseName = path.basename(pdfPath, ".pdf");
  const filesToDelete = [
    pdfPath,
    path.join(CONVERTED_DIR, `${baseName}.json`),
    path.join(PARSED_DIR, `${baseName}.json`),
  ];

  for (const filePath of filesToDelete) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted: ${filePath}`);
    }
  }
}

// ─── Combine ──────────────────────────────────────────────────────────────────

function buildCombinedDevotionalJson(): void {
  const allEntries = readAllParsedEntries();
  const deduplicatedEntries = deduplicateByDate(allEntries);
  const sortedEntries = sortByDate(deduplicatedEntries);
  writeCombinedDevotionalJson(sortedEntries);
  console.log(`Written ${sortedEntries.length} entries to public/devotional.json`);
}

function readAllParsedEntries(): DevotionalEntry[] {
  if (!fs.existsSync(PARSED_DIR)) return [];
  return fs
    .readdirSync(PARSED_DIR)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      const contents = fs.readFileSync(path.join(PARSED_DIR, name), "utf-8");
      return JSON.parse(contents) as DevotionalEntry[];
    });
}

function deduplicateByDate(entries: DevotionalEntry[]): DevotionalEntry[] {
  const byDate = new Map<string, DevotionalEntry>();
  for (const entry of entries) {
    byDate.set(entry.date, entry);
  }
  return Array.from(byDate.values());
}

function sortByDate(entries: DevotionalEntry[]): DevotionalEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function writeCombinedDevotionalJson(entries: DevotionalEntry[]): void {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PUBLIC_DIR, "devotional.json"),
    JSON.stringify(entries, null, 2),
    "utf-8"
  );
}

main().catch((error: unknown) => {
  console.error("Pipeline failed:", error);
  process.exit(1);
});
