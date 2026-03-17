import PDFParser, { type Output } from "pdf2json";
import * as fs from "fs";
import * as path from "path";

const CONVERTED_JSON_OUTPUT_DIR = path.join(process.cwd(), "data", "converted");

export async function convertPdfToJson(pdfFilePath: string): Promise<string> {
  const rawPdfData = await parsePdfFileToRawData(pdfFilePath);
  const outputFilePath = buildConvertedJsonOutputPath(pdfFilePath);
  writeJsonToFile(rawPdfData, outputFilePath);
  return outputFilePath;
}

export function buildConvertedJsonOutputPath(pdfFilePath: string): string {
  const pdfBaseName = path.basename(pdfFilePath, ".pdf");
  return path.join(CONVERTED_JSON_OUTPUT_DIR, `${pdfBaseName}.json`);
}

async function parsePdfFileToRawData(pdfFilePath: string): Promise<Output> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.on("pdfParser_dataError", (error) => {
      reject(error instanceof Error ? error : error.parserError);
    });

    parser.on("pdfParser_dataReady", (pdfData) => {
      resolve(pdfData);
    });

    parser.loadPDF(pdfFilePath);
  });
}

function writeJsonToFile(data: Output, outputFilePath: string): void {
  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 2), "utf-8");
}
