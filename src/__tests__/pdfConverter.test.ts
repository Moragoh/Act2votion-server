import * as fs from "fs";
import * as path from "path";
import { convertPdfToJson, buildConvertedJsonOutputPath } from "../services/pdfConverter";

jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock("pdf2json", () => {
  const { EventEmitter } = require("events");
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    emitter.loadPDF = jest.fn().mockImplementation(() => {
      setImmediate(() => {
        emitter.emit("pdfParser_dataReady", { Transcoder: "pdf2json", Meta: {}, Pages: [] });
      });
    });
    return emitter;
  });
});

const mockedFs = fs as jest.Mocked<typeof fs>;

afterEach(() => {
  jest.clearAllMocks();
});

describe("buildConvertedJsonOutputPath", () => {
  it("returns a .json path in data/converted with the same base name as the PDF", () => {
    const result = buildConvertedJsonOutputPath("/some/path/2026-03-17.pdf");

    expect(result).toMatch(/data[/\\]converted[/\\]2026-03-17\.json$/);
  });
});

describe("convertPdfToJson", () => {
  it("writes the parsed PDF as JSON into data/converted with a matching filename", async () => {
    const outputPath = await convertPdfToJson("/data/pdfs/2026-03-17.pdf");

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join("data", "converted")),
      { recursive: true }
    );
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("2026-03-17.json"),
      expect.any(String),
      "utf-8"
    );
    expect(outputPath).toMatch(/2026-03-17\.json$/);
  });

  it("rejects when pdf2json reports a parse error", async () => {
    const MockPDFParser = require("pdf2json") as jest.Mock;
    const parseError = new Error("Invalid PDF");

    MockPDFParser.mockImplementationOnce(() => {
      const { EventEmitter } = require("events");
      const emitter = new EventEmitter();
      emitter.loadPDF = jest.fn().mockImplementation(() => {
        setImmediate(() => {
          emitter.emit("pdfParser_dataError", { parserError: parseError });
        });
      });
      return emitter;
    });

    await expect(convertPdfToJson("/data/pdfs/bad.pdf")).rejects.toThrow("Invalid PDF");
  });
});
