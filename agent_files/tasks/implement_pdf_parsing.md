<objective>
Implement the parsing logic for the downloaded pdfs. Each downloaded pdf should be converterd to json.
</objective>

<description>
The scheduler will call the pdf downlad via a chron job. After a download, it will check if a pdf is new. It will save the pdf if it is new. 

Then the scheduler will call the parser--which is what this portion is.

There are two components: the converter and the parser.

The converter is done. Now let's work on the parser.

Read lessons.md about the observations made on the pdf. Use it to guide the development of the heuristics for extracting the date, verse, content.
</description>

<structure-of-dt>
Each day (some days are skipped), there are two main portions for DT
1) Journaling: our app can ignore this, since these prompts always stay the same
2) Bible verse OR Memory verse: Most days have a Bible Verse, followed by discussion questions. However, some days just have the Memory Verse. The server needs to parse both cases.
3) How to parse each case
    The parser needs to extract date, verses, and content whether the day as bible verses with discussion questions or memory verses. 
    IF it is a bible verse day: It should extract the date and verses, and the content should be the discussion questions
    IF it is a memory verse day: It should extract the date and verses. Content is the memory verse itself (usually written below, although it may not be.)
4) Dotted lines
The bible verse + discusison questions / Memory verse usually all appear on ONE page. So a page usually has the date at the top, the bible verse/memory verse, and then the content, followed by dotted lines which are lines to be written on (for when the pdf is printed out). We need to ignore these dotted lines. However, the dotted lines indicate that all the content has been written. If it helps, use these dotted markers as a sign that the content on that page has ended.
</structure-of-dt>

<flow-of-extraction>
The parser goes through the json page by page

1) It checks for a date. If the date does not exist, it skips
2) If it does not see the Bible verse or Memory verse, it skips (it should skip the journaling pages)
3) If it does have the bible verse or memory verse, it kniows it needs to extract that page.
4) It extracts the date
5) Content extraction: this is where it gets tricky. The discussion questions often hasve headers with questions in bullet points. This structure should be kept when parsing so that the app can display discussion questions in the same bullet point formatting
6) After the date, verse, and the content is extracted, it should perform demultiplication: check if the entry for the date exists already. If it does not, it should write the date, verse, content in the json file.
</flow-of-extraction>

<your-next-task>
Explore the json file and the pdf and help me brainstorm what heuristics should be in order to extract the date, verse, and content for both the bible verses and the memory verses while maintaining formatting such as bullet points but skipping unnecessary content. Also tell me if the flow-of-extraction sounds reasonable. 
</your-next-task>



<example>
An example json you can use in your testing / exploration is at /Users/junminkim/Desktop/Programming/Act2votion-server/data/converted/2026-03-17.json

Also look at the pdf itself at /Users/junminkim/Desktop/Programming/Act2votion-server/data/pdfs/2026-03-17.pdf
</example>

<heuristics>

## Page Classification

For each page, scan all text blocks and classify by the following rules (checked in order):

1. **Skip — Blank/Cover:** `Texts.length === 0`
2. **Skip — No date:** No text block with font size 13 (TS[1] === 13). This filters out front matter, hymn pages, and the front-section memory verse collection pages.
3. **Skip — Commentary:** Has a date (FS=13) AND any FS=14 block contains `"Commentary on"`.
4. **Skip — Journal/Prompt only:** Has a date (FS=13) but no FS=14 block containing `"Bible Text:"` and no FS=14 block containing `"Memory Verse"`.
5. **Extract — Discussion question page:** Has a date (FS=13) AND an FS=14 block containing `"Bible Text:"`.
6. **Extract — Memory verse page:** Has a date (FS=13) AND an FS=14 block containing `"Memory Verse"` (at FS=14, not the FS=19 title on the front-section pages).

## Duplicate Text Block Handling

pdf2json sometimes emits the same text at the same (x, y) coordinates twice — one copy with valid TS values, one without. Before extracting any page, deduplicate by (x, y) position, keeping the block that has a valid font size.

## Date Extraction

- Find the text block with FS=13. Its text is the date string (e.g., `"Monday, January 19, 2026"`).
- Parse to a `YYYY-MM-DD` key for the output JSON.

## Verse Reference Extraction

- **Discussion pages:** The `"Bible Text:"` block (FS=14) contains the full reference. Extract everything after `"Bible Text: "` (e.g., `"John 8:1-11 (ESV)"`).
- **Memory verse pages:** After the `"Memory Verse"` label (FS=14), find the next FS=12 block that matches a Bible reference pattern (e.g., `"John 8:12 (ESV)"`).

## Content Extraction — Discussion Question Pages

Walk through text blocks top-to-bottom after the `"Bible Text:"` header. Collect content until the stop signal:

1. **Verse sub-header:** FS=12, x ≈ 2.00, text matches a Bible reference pattern (e.g., `"John 8:3-9"`). Emit as a section header line.
2. **Bullet marker:** FS=15, text is `"•"`. Start a new question line with `"• "`.
3. **Question text:** FS=12, x ≈ 3.12 (indented). Append to the current question. Consecutive blocks at the same x with incrementing y (step ≈ 0.675) are continuation lines of the same question — concatenate them with a space.
4. **Stop signal:** FS=11 (dotted lines). All content above has been captured; stop collecting.
5. **Skip:** Header/footer blocks (FS=17, 18), spacing-only blocks.

Example output preserving structure:
```
John 8:3-9
• What caused the accusers to go away one at a time?
• How did the teachers of the law and Pharisees try to trap Jesus?
John 8:10-11
• How have I personally experienced the mercy of Jesus?
```

## Content Extraction — Memory Verse Pages

After the verse reference block, collect all FS=12 text blocks until the first FS=11 block (dotted lines). Concatenate them with spaces — this is the memory verse text itself.

Example output:
```
Again Jesus spoke to them, saying, "I am the light of the world. Whoever follows me will not walk in darkness, but will have the light of life."
```

## Output Shape (per date entry)

```json
{
  "date": "2026-01-19",
  "type": "bible_text",
  "verses": "John 8:1-11 (ESV)",
  "content": "John 8:3-9\n• What caused the accusers...\n• How did the teachers...\nJohn 8:10-11\n• How have I personally..."
}
```

```json
{
  "date": "2026-01-23",
  "type": "memory_verse",
  "verses": "John 8:12 (ESV)",
  "content": "Again Jesus spoke to them, saying, \"I am the light of the world. Whoever follows me will not walk in darkness, but will have the light of life.\""
}
```

</heuristics>