import PDFParser from "pdf2json";
import * as path from "path";

const pdfPath = path.join(process.cwd(), "data", "pdfs", "2026-03-17.pdf");

const parser = new PDFParser();

parser.on("pdfParser_dataError", (err: Error | { parserError: Error }) => {
  console.error("Parse error:", err);
});

parser.on("pdfParser_dataReady", (pdfData: unknown) => {
  console.log(JSON.stringify(pdfData, null, 2));
});

parser.loadPDF(pdfPath);
