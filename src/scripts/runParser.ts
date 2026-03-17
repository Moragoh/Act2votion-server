import * as path from "path";
import { parseConvertedJson } from "../services/pdfParser";

const DEFAULT_INPUT = path.join(
  process.cwd(),
  "data",
  "converted",
  "2026-03-17.json"
);

async function main(): Promise<void> {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;
  console.log(`Parsing: ${inputPath}`);
  const outputPath = await parseConvertedJson(inputPath);
  console.log(`Output written to: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error("Failed to parse:", error);
  process.exit(1);
});
