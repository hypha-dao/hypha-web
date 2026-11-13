import { strFromU8, unzipSync, type UnzipFileInfo } from 'fflate';

export type OfficeTextFormat = 'docx' | 'pptx' | 'xlsx' | 'odt' | 'odp' | 'ods';

export const OFFICE_FORMAT_MIME: Record<OfficeTextFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};

const MIME_FORMAT = new Map<string, OfficeTextFormat>(
  Object.entries(OFFICE_FORMAT_MIME).map(([format, mime]) => [
    mime,
    format as OfficeTextFormat,
  ]),
);

export function officeFormatForMime(mime: string): OfficeTextFormat | null {
  return MIME_FORMAT.get(mime.toLowerCase()) ?? null;
}

export type OfficeTextResult =
  | { ok: true; format: OfficeTextFormat; text: string; truncated: boolean }
  | { ok: false; reason: 'not_office' | 'unreadable' | 'too_large' };

/** Limits on what a document may inflate to; a zip states sizes up front. */
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const MAX_PARTS = 300;
const MAX_ROWS_PER_SHEET = 2000;
const MAX_REPEAT = 256;

export function looksLikeZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

class TooLarge extends Error {}

type ZipParts = {
  names: string[];
  read: (names: string[]) => Map<string, string>;
};

function openZip(bytes: Uint8Array): ZipParts {
  const entries = new Map<string, number>();
  unzipSync(bytes, {
    filter: (file: UnzipFileInfo) => {
      entries.set(file.name, file.originalSize);
      return false;
    },
  });
  return {
    names: [...entries.keys()],
    read: (wanted) => {
      const want = new Set(wanted.filter((name) => entries.has(name)));
      let total = 0;
      for (const name of want) {
        const size = entries.get(name) ?? 0;
        if (size > MAX_ENTRY_BYTES) throw new TooLarge();
        total += size;
      }
      if (total > MAX_TOTAL_BYTES) throw new TooLarge();
      const files = unzipSync(bytes, { filter: (file) => want.has(file.name) });
      const out = new Map<string, string>();
      for (const [name, data] of Object.entries(files)) {
        out.set(name, strFromU8(data));
      }
      return out;
    },
  };
}

type XmlHandlers = {
  open?: (
    name: string,
    attrs: Record<string, string>,
    selfClosing: boolean,
  ) => void;
  close?: (name: string) => void;
  text?: (value: string) => void;
};

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlEntities(value: string): string {
  if (!value.includes('&')) return value;
  let out = '';
  let i = 0;
  while (i < value.length) {
    const amp = value.indexOf('&', i);
    if (amp === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, amp);
    const semi = value.indexOf(';', amp + 1);
    if (semi === -1 || semi - amp > 10) {
      out += '&';
      i = amp + 1;
      continue;
    }
    const body = value.slice(amp + 1, semi);
    let decoded: string | undefined;
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          decoded = String.fromCodePoint(code);
        } catch {
          decoded = undefined;
        }
      }
    } else {
      decoded = XML_ENTITIES[body];
    }
    if (decoded === undefined) {
      out += '&';
      i = amp + 1;
    } else {
      out += decoded;
      i = semi + 1;
    }
  }
  return out;
}

function isSpace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let i = 0;
  while (i < source.length) {
    while (i < source.length && isSpace(source[i])) i += 1;
    const nameStart = i;
    while (
      i < source.length &&
      source[i] !== '=' &&
      !isSpace(source[i]) &&
      source[i] !== '/'
    ) {
      i += 1;
    }
    const name = source.slice(nameStart, i);
    if (!name) {
      i += 1;
      continue;
    }
    while (i < source.length && isSpace(source[i])) i += 1;
    if (source[i] !== '=') continue;
    i += 1;
    while (i < source.length && isSpace(source[i])) i += 1;
    const quote = source[i];
    if (quote !== '"' && quote !== "'") continue;
    const end = source.indexOf(quote, i + 1);
    if (end === -1) break;
    attrs[name] = decodeXmlEntities(source.slice(i + 1, end));
    i = end + 1;
  }
  return attrs;
}

/** Single linear pass; document XML is untrusted, so no backtracking regexes. */
function scanXml(xml: string, handlers: XmlHandlers): void {
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) {
      if (i < xml.length) handlers.text?.(decodeXmlEntities(xml.slice(i)));
      return;
    }
    if (lt > i) handlers.text?.(decodeXmlEntities(xml.slice(i, lt)));
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      i = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      handlers.text?.(xml.slice(lt + 9, end === -1 ? xml.length : end));
      i = end === -1 ? xml.length : end + 3;
      continue;
    }
    const gt = xml.indexOf('>', lt + 1);
    if (gt === -1) return;
    const inner = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (inner[0] === '?' || inner[0] === '!') continue;
    if (inner[0] === '/') {
      handlers.close?.(inner.slice(1).trim());
      continue;
    }
    const selfClosing = inner.endsWith('/');
    const body = selfClosing ? inner.slice(0, -1) : inner;
    let nameEnd = 0;
    while (nameEnd < body.length && !isSpace(body[nameEnd])) nameEnd += 1;
    const name = body.slice(0, nameEnd);
    handlers.open?.(name, parseAttributes(body.slice(nameEnd)), selfClosing);
    if (selfClosing) handlers.close?.(name);
  }
}

/** Collects lines and stops growing once the character budget is spent. */
class TextSink {
  private parts: string[] = [];
  private length = 0;
  truncated = false;

  constructor(private readonly maxChars: number) {}

  get full(): boolean {
    return this.length >= this.maxChars;
  }

  push(line: string): void {
    if (this.full) {
      if (line) this.truncated = true;
      return;
    }
    this.parts.push(line);
    this.length += line.length + 1;
  }

  toString(): string {
    const lines: string[] = [];
    for (const line of this.parts.join('\n').split('\n')) {
      const trimmed = line.trimEnd();
      if (!trimmed && !lines.at(-1)) continue;
      lines.push(trimmed);
    }
    const text = lines.join('\n').trim();
    if (text.length > this.maxChars) {
      this.truncated = true;
      return text.slice(0, this.maxChars);
    }
    return text;
  }
}

function localName(name: string): string {
  const colon = name.indexOf(':');
  return colon === -1 ? name : name.slice(colon + 1);
}

function numbered(names: string[], prefix: string, suffix: string): string[] {
  return names
    .filter(
      (name) =>
        name.startsWith(prefix) &&
        name.endsWith(suffix) &&
        /^\d+$/.test(name.slice(prefix.length, -suffix.length)),
    )
    .sort(
      (a, b) =>
        Number(a.slice(prefix.length, -suffix.length)) -
        Number(b.slice(prefix.length, -suffix.length)),
    )
    .slice(0, MAX_PARTS);
}

function docxText(xml: string, sink: TextSink): void {
  let paragraph = '';
  let prefix = '';
  let inText = 0;
  scanXml(xml, {
    open: (name, attrs, selfClosing) => {
      if (name === 'w:p') {
        paragraph = '';
        prefix = '';
      } else if (name === 'w:t' && !selfClosing) {
        inText += 1;
      } else if (name === 'w:tab') {
        paragraph += '\t';
      } else if (name === 'w:br' || name === 'w:cr') {
        paragraph += '\n';
      } else if (name === 'w:pStyle') {
        const style = attrs['w:val'] ?? '';
        const heading = /^heading(\d)$/i.exec(style);
        if (heading) prefix = `${'#'.repeat(Number(heading[1]))} `;
        else if (/^title$/i.test(style)) prefix = '# ';
      } else if (name === 'w:numPr' && !prefix) {
        prefix = '- ';
      }
    },
    close: (name) => {
      if (name === 'w:t') inText = Math.max(0, inText - 1);
      else if (name === 'w:p') {
        const text = paragraph.trim();
        sink.push(text ? `${prefix}${text}` : '');
        paragraph = '';
      }
    },
    text: (value) => {
      if (inText > 0) paragraph += value;
    },
  });
}

function drawingMlText(xml: string): string[] {
  const lines: string[] = [];
  let paragraph = '';
  let inText = 0;
  scanXml(xml, {
    open: (name, _attrs, selfClosing) => {
      if (name === 'a:t' && !selfClosing) inText += 1;
      else if (name === 'a:br') paragraph += '\n';
    },
    close: (name) => {
      if (name === 'a:t') inText = Math.max(0, inText - 1);
      else if (name === 'a:p') {
        if (paragraph.trim()) lines.push(paragraph.trim());
        paragraph = '';
      }
    },
    text: (value) => {
      if (inText > 0) paragraph += value;
    },
  });
  return lines;
}

function columnIndex(ref: string | undefined): number | null {
  if (!ref) return null;
  let index = 0;
  let i = 0;
  for (; i < ref.length; i += 1) {
    const code = ref.charCodeAt(i);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return i === 0 ? null : index - 1;
}

function rowLine(cells: string[]): string | null {
  let end = cells.length;
  while (end > 0 && !cells[end - 1]?.trim()) end -= 1;
  if (end === 0) return null;
  return cells
    .slice(0, end)
    .map((cell) => cell.replace(/\s+/g, ' ').trim())
    .join(' | ');
}

function xlsxSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  let current = '';
  let inText = 0;
  let inPhonetic = 0;
  scanXml(xml, {
    open: (name, _attrs, selfClosing) => {
      if (selfClosing) return;
      if (name === 'si') current = '';
      else if (name === 't') inText += 1;
      else if (name === 'rPh') inPhonetic += 1;
    },
    close: (name) => {
      if (name === 'si') strings.push(current);
      else if (name === 't') inText = Math.max(0, inText - 1);
      else if (name === 'rPh') inPhonetic = Math.max(0, inPhonetic - 1);
    },
    text: (value) => {
      if (inText > 0 && inPhonetic === 0) current += value;
    },
  });
  return strings;
}

function xlsxSheetText(xml: string, shared: string[], sink: TextSink): void {
  let cells: string[] = [];
  let rows = 0;
  let cellType = '';
  let cellColumn: number | null = null;
  let value = '';
  let capture = 0;
  scanXml(xml, {
    open: (name, attrs, selfClosing) => {
      if (name === 'row') cells = [];
      else if (name === 'c') {
        cellType = attrs.t ?? '';
        cellColumn = columnIndex(attrs.r);
        value = '';
      } else if ((name === 'v' || name === 't') && !selfClosing) {
        capture += 1;
      }
    },
    close: (name) => {
      if (name === 'v' || name === 't') capture = Math.max(0, capture - 1);
      else if (name === 'c') {
        let text = value;
        if (cellType === 's') text = shared[Number(value)] ?? '';
        else if (cellType === 'b') text = value === '1' ? 'TRUE' : 'FALSE';
        const column =
          cellColumn !== null && cellColumn < 1024 ? cellColumn : cells.length;
        while (cells.length < column) cells.push('');
        cells[column] = text;
      } else if (name === 'row') {
        const line = rowLine(cells);
        if (line && rows < MAX_ROWS_PER_SHEET) {
          sink.push(line);
          rows += 1;
        } else if (line) {
          sink.truncated = true;
        }
      }
    },
    text: (text) => {
      if (capture > 0) value += text;
    },
  });
}

function xlsxSheets(
  parts: Map<string, string>,
): Array<{ name: string; path: string }> {
  const rels = new Map<string, string>();
  scanXml(parts.get('xl/_rels/workbook.xml.rels') ?? '', {
    open: (name, attrs) => {
      if (localName(name) !== 'Relationship' || !attrs.Id || !attrs.Target) {
        return;
      }
      const target = attrs.Target.replace(/^\/?xl\//, '').replace(/^\//, '');
      rels.set(attrs.Id, `xl/${target}`);
    },
  });
  const sheets: Array<{ name: string; path: string }> = [];
  scanXml(parts.get('xl/workbook.xml') ?? '', {
    open: (name, attrs) => {
      if (localName(name) !== 'sheet') return;
      const id = attrs['r:id'];
      const path = id ? rels.get(id) : undefined;
      if (path) sheets.push({ name: attrs.name ?? '', path });
    },
  });
  return sheets.slice(0, MAX_PARTS);
}

/** OpenDocument `content.xml`: text, presentations and spreadsheets. */
function odfText(
  xml: string,
  format: 'odt' | 'odp' | 'ods',
  sink: TextSink,
): void {
  let paragraph = '';
  let prefix = '';
  let paragraphDepth = 0;
  let listDepth = 0;
  let slide = 0;
  let ignored = 0;
  let cells: string[] | null = null;
  let cell: string[] | null = null;
  let cellRepeat = 1;
  let rows = 0;

  const flushParagraph = () => {
    const text = paragraph.trim();
    paragraph = '';
    if (cell) {
      if (text) cell.push(text);
      return;
    }
    if (text) sink.push(`${prefix}${text}`);
    else if (format === 'odt') sink.push('');
  };

  scanXml(xml, {
    open: (name, attrs, selfClosing) => {
      if (ignored > 0) {
        if (!selfClosing) ignored += 1;
        return;
      }
      if (
        name === 'office:annotation' ||
        name === 'text:tracked-changes' ||
        name === 'presentation:notes'
      ) {
        if (!selfClosing) ignored = 1;
        return;
      }
      if (name === 'text:p' || name === 'text:h') {
        paragraphDepth += 1;
        if (paragraphDepth === 1) {
          paragraph = '';
          const level = Number(attrs['text:outline-level'] ?? '1');
          prefix =
            name === 'text:h'
              ? `${'#'.repeat(Math.min(6, Math.max(1, level || 1)))} `
              : listDepth > 0
              ? '- '
              : '';
        }
        if (selfClosing) {
          paragraphDepth -= 1;
          if (paragraphDepth === 0) flushParagraph();
        }
      } else if (name === 'text:list-item') {
        listDepth += selfClosing ? 0 : 1;
      } else if (name === 'text:s') {
        const count = Math.min(MAX_REPEAT, Number(attrs['text:c'] ?? '1') || 1);
        paragraph += ' '.repeat(count);
      } else if (name === 'text:tab') {
        paragraph += '\t';
      } else if (name === 'text:line-break') {
        paragraph += '\n';
      } else if (name === 'draw:page') {
        slide += 1;
        sink.push(`## ${attrs['draw:name']?.trim() || `Slide ${slide}`}`);
      } else if (name === 'table:table' && format === 'ods') {
        rows = 0;
        sink.push(`## ${attrs['table:name']?.trim() || 'Sheet'}`);
      } else if (name === 'table:table-row' && format === 'ods') {
        cells = [];
      } else if (
        (name === 'table:table-cell' || name === 'table:covered-table-cell') &&
        cells
      ) {
        cellRepeat = Math.min(
          MAX_REPEAT,
          Number(attrs['table:number-columns-repeated'] ?? '1') || 1,
        );
        cell = [];
        if (selfClosing) {
          for (let n = 0; n < cellRepeat; n += 1) cells.push('');
          cell = null;
        }
      }
    },
    close: (name) => {
      if (ignored > 0) {
        ignored -= 1;
        return;
      }
      if (name === 'text:p' || name === 'text:h') {
        paragraphDepth = Math.max(0, paragraphDepth - 1);
        if (paragraphDepth === 0) flushParagraph();
      } else if (name === 'text:list-item') {
        listDepth = Math.max(0, listDepth - 1);
      } else if (
        (name === 'table:table-cell' || name === 'table:covered-table-cell') &&
        cells &&
        cell
      ) {
        const text = cell.join(' ');
        for (let n = 0; n < cellRepeat; n += 1) cells.push(text);
        cell = null;
      } else if (name === 'table:table-row' && cells) {
        const line = rowLine(cells);
        if (line && rows < MAX_ROWS_PER_SHEET) {
          sink.push(line);
          rows += 1;
        } else if (line) {
          sink.truncated = true;
        }
        cells = null;
      } else if (name === 'draw:page') {
        sink.push('');
      }
    },
    text: (value) => {
      if (ignored === 0 && paragraphDepth > 0) paragraph += value;
    },
  });
}

function detectFormat(
  zip: ZipParts,
): { format: OfficeTextFormat; mimetype?: string } | null {
  const names = new Set(zip.names);
  if (names.has('word/document.xml')) return { format: 'docx' };
  if (names.has('ppt/presentation.xml')) return { format: 'pptx' };
  if (names.has('xl/workbook.xml')) return { format: 'xlsx' };
  if (names.has('mimetype') && names.has('content.xml')) {
    const mimetype = zip.read(['mimetype']).get('mimetype')?.trim() ?? '';
    if (mimetype === OFFICE_FORMAT_MIME.odt) return { format: 'odt' };
    if (mimetype === OFFICE_FORMAT_MIME.odp) return { format: 'odp' };
    if (mimetype === OFFICE_FORMAT_MIME.ods) return { format: 'ods' };
  }
  return null;
}

/**
 * Plain text (lightly Markdown: headings, list items, slide and sheet titles,
 * `|`-separated rows) from Word, PowerPoint and Excel files (.docx, .pptx,
 * .xlsx) and their OpenDocument counterparts (.odt, .odp, .ods).
 */
export function extractOfficeText(
  bytes: Uint8Array,
  { maxChars }: { maxChars: number },
): OfficeTextResult {
  if (!looksLikeZip(bytes)) return { ok: false, reason: 'not_office' };
  try {
    const zip = openZip(bytes);
    const detected = detectFormat(zip);
    if (!detected) return { ok: false, reason: 'not_office' };
    const { format } = detected;
    const sink = new TextSink(maxChars);

    if (format === 'docx') {
      const parts = zip.read(['word/document.xml']);
      docxText(parts.get('word/document.xml') ?? '', sink);
    } else if (format === 'pptx') {
      const slides = numbered(zip.names, 'ppt/slides/slide', '.xml');
      const parts = zip.read(slides);
      slides.forEach((path, index) => {
        if (sink.full) return;
        const lines = drawingMlText(parts.get(path) ?? '');
        if (lines.length === 0) return;
        sink.push(`## Slide ${index + 1}`);
        for (const line of lines) sink.push(line);
        sink.push('');
      });
    } else if (format === 'xlsx') {
      const meta = zip.read([
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/sharedStrings.xml',
      ]);
      const sheets = xlsxSheets(meta);
      const parts = zip.read(sheets.map((sheet) => sheet.path));
      const shared = xlsxSharedStrings(meta.get('xl/sharedStrings.xml'));
      for (const sheet of sheets) {
        if (sink.full) break;
        sink.push(`## ${sheet.name.trim() || 'Sheet'}`);
        xlsxSheetText(parts.get(sheet.path) ?? '', shared, sink);
        sink.push('');
      }
    } else {
      const parts = zip.read(['content.xml']);
      odfText(parts.get('content.xml') ?? '', format, sink);
    }

    const text = sink.toString();
    return { ok: true, format, text, truncated: sink.truncated };
  } catch (error) {
    if (error instanceof TooLarge) return { ok: false, reason: 'too_large' };
    return { ok: false, reason: 'unreadable' };
  }
}
