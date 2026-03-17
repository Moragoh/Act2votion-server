import { downloadLatestPdf } from "../services/pdfFetcher";

async function main(): Promise<void> {
  console.log("Fetching latest devotional PDF...");
  const savedPath = await downloadLatestPdf();
  console.log(`PDF saved to: ${savedPath}`);
}

main().catch((error: unknown) => {
  console.error("Failed to fetch PDF:", error);
  process.exit(1);
});
