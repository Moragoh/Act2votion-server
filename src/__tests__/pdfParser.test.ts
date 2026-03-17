import * as path from "path";
import {
  extractDevotionalEntries,
  buildParsedOutputPath,
  isBibleReference,
  formatDateToIso,
  type DevotionalEntry,
} from "../services/pdfParser";
import type { Page } from "pdf2json";

const FIXTURE_JSON_PATH = path.join(
  process.cwd(),
  "data",
  "converted",
  "2026-03-17.json"
);

function loadFixturePages(): Page[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const data: { Pages: Page[] } = require(FIXTURE_JSON_PATH);
  return data.Pages;
}

describe("buildParsedOutputPath", () => {
  it("returns a .json path in data/parsed with the same base name as the input", () => {
    const result = buildParsedOutputPath("/some/path/2026-03-17.json");

    expect(result).toMatch(/data[/\\]parsed[/\\]2026-03-17\.json$/);
  });
});

describe("isBibleReference", () => {
  it("matches standard verse ranges", () => {
    expect(isBibleReference("John 8:3-9")).toBe(true);
    expect(isBibleReference("1 John 2:1 (ESV)")).toBe(true);
    expect(isBibleReference("1 Corinthians 3:1-4")).toBe(true);
  });

  it("rejects non-reference text", () => {
    expect(isBibleReference("JOHN")).toBe(false);
    expect(isBibleReference("ACTS2 NETWORK DEVOTIONALS")).toBe(false);
    expect(isBibleReference("Memory Verse")).toBe(false);
    expect(isBibleReference("Bible Text: John 8:1-11")).toBe(false);
  });
});

describe("formatDateToIso", () => {
  it("converts a full date string to YYYY-MM-DD", () => {
    expect(formatDateToIso("Monday, January 19, 2026")).toBe("2026-01-19");
    expect(formatDateToIso("Friday, January 23, 2026")).toBe("2026-01-23");
    expect(formatDateToIso("Tuesday, January 20, 2026")).toBe("2026-01-20");
  });
});

describe("extractDevotionalEntries (integration)", () => {
  let entries: DevotionalEntry[];

  beforeAll(() => {
    entries = extractDevotionalEntries(loadFixturePages());
  });

  it("produces the expected total number of entries", () => {
    expect(entries).toHaveLength(60);
  });

  it("produces the expected count of each entry type", () => {
    const bibleTextEntries = entries.filter((e) => e.type === "bible_text");
    const memoryVerseEntries = entries.filter((e) => e.type === "memory_verse");

    expect(bibleTextEntries).toHaveLength(48);
    expect(memoryVerseEntries).toHaveLength(12);
  });

  it("all entries have valid ISO dates", () => {
    for (const entry of entries) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("all entries have non-empty verse references", () => {
    for (const entry of entries) {
      expect(entry.verses.length).toBeGreaterThan(0);
    }
  });

  it("all entries have non-empty content", () => {
    for (const entry of entries) {
      expect(entry.content.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate dates", () => {
    const dates = entries.map((e) => e.date);
    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(entries.length);
  });

  describe("bible_text entry spot-check (January 19, 2026)", () => {
    let entry: DevotionalEntry | undefined;

    beforeAll(() => {
      entry = entries.find((e) => e.date === "2026-01-19");
    });

    it("finds the entry", () => {
      expect(entry).toBeDefined();
    });

    it("has the correct type", () => {
      expect(entry?.type).toBe("bible_text");
    });

    it("has the correct verse reference", () => {
      expect(entry?.verses).toBe("John 8:1-11 (ESV)");
    });

    it("contains verse sub-headers in content", () => {
      expect(entry?.content).toContain("John 8:3-9");
      expect(entry?.content).toContain("John 8:10-11");
    });

    it("contains bullet-point discussion questions", () => {
      expect(entry?.content).toContain("•");
    });
  });

  describe("memory_verse entry spot-check (January 23, 2026)", () => {
    let entry: DevotionalEntry | undefined;

    beforeAll(() => {
      entry = entries.find((e) => e.date === "2026-01-23");
    });

    it("finds the entry", () => {
      expect(entry).toBeDefined();
    });

    it("has the correct type", () => {
      expect(entry?.type).toBe("memory_verse");
    });

    it("has the correct verse reference", () => {
      expect(entry?.verses).toBe("John 8:12 (ESV)");
    });

    it("content is the verse text, not discussion questions", () => {
      expect(entry?.content).toContain("Again Jesus spoke");
      expect(entry?.content).not.toContain("•");
    });
  });
});
