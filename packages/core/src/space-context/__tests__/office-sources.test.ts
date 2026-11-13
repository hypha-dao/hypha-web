import { describe, expect, it } from 'vitest';
import { strToU8, zipSync, type Zippable } from 'fflate';

import { extractOfficeText } from '../../common/server/office-text';
import { decodeSharedSourceBytes } from '../server/shared-source';

const zip = (files: Record<string, string>): Uint8Array => {
  const entries: Zippable = {};
  for (const [name, body] of Object.entries(files))
    entries[name] = strToU8(body);
  return zipSync(entries);
};

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

function buildDocx(): Uint8Array {
  return zip({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': `<?xml version="1.0"?>
<w:document ${W}><w:body>
  <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Our Mission</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">We grow food </w:t></w:r><w:r><w:t>&amp; share tools.</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Values</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Care</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Trust</w:t></w:r></w:p>
</w:body></w:document>`,
  });
}

function buildPptx(): Uint8Array {
  const slide = (lines: string[]) =>
    `<p:sld xmlns:p="p" ${A}><p:cSld><p:spTree>${lines
      .map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`)
      .join('')}</p:spTree></p:cSld></p:sld>`;
  return zip({
    'ppt/presentation.xml': '<p:presentation/>',
    'ppt/slides/slide10.xml': slide(['Roadmap']),
    'ppt/slides/slide2.xml': slide(['Strategy', 'Grow the network']),
    'ppt/slides/slide1.xml': slide(['Vision', 'Thriving local food']),
  });
}

function buildXlsx(): Uint8Array {
  return zip({
    'xl/workbook.xml': `<workbook xmlns:r="r"><sheets><sheet name="Goals" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `<sst><si><t>Goal</t></si><si><t>Owner</t></si><si><t>Open a seed library</t></si><si><r><t>Ana</t></r><rPh><t>ana</t></rPh></si></sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1"><v>Target</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>2027</v></c></row>
<row r="3"><c r="C3" t="inlineStr"><is><t>later</t></is></c></row>
</sheetData></worksheet>`,
  });
}

const ODF_NS =
  'xmlns:office="o" xmlns:text="t" xmlns:table="tb" xmlns:draw="d" xmlns:presentation="p"';

function buildOdf(mimetype: string, body: string): Uint8Array {
  return zip({
    mimetype,
    'content.xml': `<?xml version="1.0"?><office:document-content ${ODF_NS}><office:body>${body}</office:body></office:document-content>`,
  });
}

const buildOdt = () =>
  buildOdf(
    'application/vnd.oasis.opendocument.text',
    `<office:text>
<text:h text:outline-level="1">Our Strategy</text:h>
<text:p>Start<text:s text:c="2"/>small<office:annotation><text:p>reviewer note</text:p></office:annotation>, then grow.</text:p>
<text:list><text:list-item><text:p>Meet monthly</text:p></text:list-item></text:list>
</office:text>`,
  );

const buildOdp = () =>
  buildOdf(
    'application/vnd.oasis.opendocument.presentation',
    `<office:presentation>
<draw:page draw:name="Intro"><draw:frame><draw:text-box><text:p>Who we are</text:p></draw:text-box></draw:frame>
<presentation:notes><text:p>speaker only</text:p></presentation:notes></draw:page>
</office:presentation>`,
  );

const buildOds = () =>
  buildOdf(
    'application/vnd.oasis.opendocument.spreadsheet',
    `<office:spreadsheet><table:table table:name="Budget">
<table:table-row><table:table-cell><text:p>Item</text:p></table:table-cell><table:table-cell><text:p>Cost</text:p></table:table-cell></table:table-row>
<table:table-row><table:table-cell><text:p>Seeds</text:p></table:table-cell><table:table-cell><text:p>40</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1000"/></table:table-row>
<table:table-row table:number-rows-repeated="1000"><table:table-cell table:number-columns-repeated="1000"/></table:table-row>
</table:table></office:spreadsheet>`,
  );

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};

describe('decodeSharedSourceBytes with documents', () => {
  it('reads Word documents as text with headings and lists', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: buildDocx(),
      contentType: MIME.docx,
      filename: 'mission.docx',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text', mime: MIME.docx });
    expect(result.ok && result.text).toBe(
      '# Our Mission\nWe grow food & share tools.\n## Values\n- Care\n- Trust',
    );
  });

  it('reads PowerPoint slides in slide order', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: buildPptx(),
      contentType: 'application/octet-stream',
      filename: 'deck.pptx',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text', mime: MIME.pptx });
    expect(result.ok && result.text).toBe(
      '## Slide 1\nVision\nThriving local food\n\n## Slide 2\nStrategy\nGrow the network\n\n## Slide 3\nRoadmap',
    );
  });

  it('reads Excel sheets as rows', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: buildXlsx(),
      contentType: MIME.xlsx,
      filename: 'goals.xlsx',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text', mime: MIME.xlsx });
    expect(result.ok && result.text).toBe(
      '## Goals\nGoal | Owner | Target\nOpen a seed library | Ana | 2027\n |  | later',
    );
  });

  it('reads OpenDocument text without comments', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: buildOdt(),
      contentType: null,
      filename: 'strategy.odt',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text', mime: MIME.odt });
    expect(result.ok && result.text).toBe(
      '# Our Strategy\nStart  small, then grow.\n- Meet monthly',
    );
  });

  it('reads OpenDocument presentations without speaker notes', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: buildOdp(),
      contentType: 'application/zip',
      filename: 'intro.odp',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text', mime: MIME.odp });
    expect(result.ok && result.text).toBe('## Intro\nWho we are');
  });

  it('reads OpenDocument spreadsheets and skips empty repeated cells', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: buildOds(),
      contentType: MIME.ods,
      filename: 'budget.ods',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text', mime: MIME.ods });
    expect(result.ok && result.text).toBe('## Budget\nItem | Cost\nSeeds | 40');
  });

  it('recognises a document from its contents when the type is generic', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: buildDocx(),
      contentType: 'application/octet-stream',
      filename: 'download',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text', mime: MIME.docx });
  });

  it('reads Markdown and CSV as text', async () => {
    const md = await decodeSharedSourceBytes({
      bytes: new TextEncoder().encode('# Vision\nA fair food system.'),
      contentType: 'application/octet-stream',
      filename: 'vision.markdown',
    });
    expect(md).toMatchObject({ ok: true, mode: 'text', mime: 'text/markdown' });
    const csv = await decodeSharedSourceBytes({
      bytes: new TextEncoder().encode('goal,owner\nseeds,ana'),
      contentType: null,
      filename: 'goals.csv',
    });
    expect(csv).toMatchObject({
      ok: true,
      mode: 'text',
      text: 'goal,owner\nseeds,ana',
    });
  });

  it('explains that older Office files cannot be read', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      contentType: null,
      filename: 'mission.doc',
    });
    expect(result).toMatchObject({ ok: false, code: 'unsupported_type' });
    expect(!result.ok && result.error).toContain('.docx');
    expect(!result.ok && result.error).toContain('Supported:');
  });

  it('explains when a .docx is not a readable document', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      contentType: MIME.docx,
      filename: 'locked.docx',
    });
    expect(result).toMatchObject({ ok: false, code: 'decode_failed' });
    expect(!result.ok && result.error).toContain('password-protected');
  });

  it('refuses other archives with the supported list', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: zip({ 'notes.txt': 'hello' }),
      contentType: 'application/zip',
      filename: 'notes.zip',
    });
    expect(result).toMatchObject({ ok: false, code: 'unsupported_type' });
    expect(!result.ok && result.error).toContain('Word (.docx)');
  });

  it('reports a document with no text', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: zip({
        'word/document.xml': `<w:document ${W}><w:body/></w:document>`,
      }),
      contentType: MIME.docx,
      filename: 'blank.docx',
    });
    expect(result).toMatchObject({ ok: false, code: 'decode_failed' });
  });
});

describe('extractOfficeText', () => {
  it('stops at the character budget', () => {
    const paragraphs = Array.from(
      { length: 200 },
      (_, i) =>
        `<w:p><w:r><w:t>Paragraph ${i} with some words.</w:t></w:r></w:p>`,
    ).join('');
    const result = extractOfficeText(
      zip({
        'word/document.xml': `<w:document ${W}><w:body>${paragraphs}</w:body></w:document>`,
      }),
      { maxChars: 500 },
    );
    expect(result).toMatchObject({ ok: true, format: 'docx', truncated: true });
    expect(result.ok && result.text.length).toBeLessThanOrEqual(500);
  });

  it('refuses parts that would inflate past the size limit', () => {
    const big = zip({
      'word/document.xml': `<w:document ${W}><w:body><w:p><w:r><w:t>${'a'.repeat(
        17 * 1024 * 1024,
      )}</w:t></w:r></w:p></w:body></w:document>`,
    });
    expect(extractOfficeText(big, { maxChars: 1000 })).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('reports a damaged archive as unreadable', () => {
    const bytes = buildDocx();
    const damaged = bytes.slice(0, Math.floor(bytes.length / 2));
    expect(extractOfficeText(damaged, { maxChars: 1000 }).ok).toBe(false);
  });
});
