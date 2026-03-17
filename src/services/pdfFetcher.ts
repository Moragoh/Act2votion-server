import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

const DEVOTIONAL_WEBSITE_URL = "https://devotions.acts2.network/";
const PDF_OUTPUT_DIR = path.join(process.cwd(), "data", "pdfs");

export async function downloadLatestPdf(): Promise<string> {
  const previewUrl = await scrapeLatestPdfUrl(DEVOTIONAL_WEBSITE_URL);
  const downloadableUrl = buildDownloadableUrl(previewUrl);
  const outputFilePath = buildOutputFilePath(PDF_OUTPUT_DIR);
  await downloadPdfToFile(downloadableUrl, outputFilePath);
  return outputFilePath;
}

export async function scrapeLatestPdfUrl(websiteUrl: string): Promise<string> {
  const { data } = await axios.get(websiteUrl);
  const $ = cheerio.load(data);
  const pdfUrl = $('a[href*=".pdf"]').first().attr("href");

  if (!pdfUrl) {
    throw new Error(`No PDF link found on ${websiteUrl}`);
  }

  return pdfUrl;
}

export function buildDownloadableUrl(previewUrl: string): string {
  return previewUrl.replace("dl=0", "dl=1");
}

export function buildOutputFilePath(outputDir: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(outputDir, `${today}.pdf`);
}

export async function downloadPdfToFile(
  downloadUrl: string,
  outputFilePath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  const response = await axios({ url: downloadUrl, method: "GET", responseType: "stream" });
  const writeStream = fs.createWriteStream(outputFilePath);

  return new Promise((resolve, reject) => {
    response.data.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
}
