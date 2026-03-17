import axios from "axios";
import * as fs from "fs";
import { PassThrough } from "stream";
import {
  scrapeLatestPdfUrl,
  buildDownloadableUrl,
  buildOutputFilePath,
  downloadPdfToFile,
} from "../services/pdfFetcher";

jest.mock("axios");
jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

afterEach(() => {
  jest.clearAllMocks();
});

describe("scrapeLatestPdfUrl", () => {
  it("returns the PDF href from the page", async () => {
    const html = `<html><body>
      <a href="https://www.dropbox.com/scl/fi/abc/devotional.pdf?rlkey=xyz&dl=0">Download PDF</a>
    </body></html>`;
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: html });

    const result = await scrapeLatestPdfUrl("https://devotions.acts2.network/");

    expect(result).toBe(
      "https://www.dropbox.com/scl/fi/abc/devotional.pdf?rlkey=xyz&dl=0"
    );
  });

  it("throws when no PDF link is found on the page", async () => {
    (axios.get as jest.Mock).mockResolvedValueOnce({
      data: "<html><body>No PDFs here</body></html>",
    });

    await expect(
      scrapeLatestPdfUrl("https://devotions.acts2.network/")
    ).rejects.toThrow("No PDF link found");
  });
});

describe("buildDownloadableUrl", () => {
  it("replaces dl=0 with dl=1 to force a file download", () => {
    const previewUrl =
      "https://www.dropbox.com/scl/fi/abc/devotional.pdf?rlkey=xyz&dl=0";

    const result = buildDownloadableUrl(previewUrl);

    expect(result).toBe(
      "https://www.dropbox.com/scl/fi/abc/devotional.pdf?rlkey=xyz&dl=1"
    );
  });
});

describe("buildOutputFilePath", () => {
  it("returns a YYYY-MM-DD.pdf path inside the given output directory", () => {
    const result = buildOutputFilePath("/data/pdfs");

    expect(result).toMatch(/\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(result.startsWith("/data/pdfs")).toBe(true);
  });
});

describe("downloadPdfToFile", () => {
  it("creates the output directory and writes the PDF stream to the file", async () => {
    const fakeResponseStream = new PassThrough();
    const fakeWriteStream = new PassThrough();

    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: fakeResponseStream,
    });
    mockedFs.mkdirSync.mockReturnValue(undefined);
    mockedFs.createWriteStream.mockReturnValue(
      fakeWriteStream as unknown as fs.WriteStream
    );

    setImmediate(() => fakeResponseStream.end());

    await downloadPdfToFile(
      "https://example.com/file.pdf",
      "/data/pdfs/2026-03-17.pdf"
    );

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith("/data/pdfs", { recursive: true });
    expect(mockedFs.createWriteStream).toHaveBeenCalledWith("/data/pdfs/2026-03-17.pdf");
  });
});
