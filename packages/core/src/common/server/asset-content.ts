// Apps that compile this file through imports would not pick up the ambient
// declaration otherwise.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./pdfjs-worker.d.ts" />
import { createRequire } from 'node:module';

export const ASSET_DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
export const ASSET_MAX_BYTES_LIMIT = 4 * 1024 * 1024;
export const ASSET_MAX_TEXT_CHARS = 48_000;

export function normalizeMime(
  headerMime: string | null,
  filename: string,
): string {
  const h = headerMime?.split(';')[0]?.trim().toLowerCase();
  if (h && h !== 'application/octet-stream') return h;
  const fn = filename.toLowerCase();
  if (fn.endsWith('.png')) return 'image/png';
  if (fn.endsWith('.jpg') || fn.endsWith('.jpeg')) return 'image/jpeg';
  if (fn.endsWith('.gif')) return 'image/gif';
  if (fn.endsWith('.webp')) return 'image/webp';
  if (fn.endsWith('.svg')) return 'image/svg+xml';
  if (fn.endsWith('.pdf')) return 'application/pdf';
  if (fn.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (fn.endsWith('.doc')) return 'application/msword';
  if (fn.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (fn.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (fn.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (fn.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (fn.endsWith('.txt') || fn.endsWith('.md')) return 'text/plain';
  return headerMime?.split(';')[0]?.trim() || 'application/octet-stream';
}

export function isPlaintextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith('text/') ||
    m === 'application/json' ||
    m === 'application/xml' ||
    m.endsWith('+xml') ||
    m.endsWith('+json')
  );
}

export function isImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('image/');
}

export function isPdfMime(mime: string): boolean {
  return mime.toLowerCase() === 'application/pdf';
}

export function isVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('video/');
}

/** Office docs — binary for AI; true transcription deferred (no mammoth in v1). */
export function isOfficeDocMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'application/msword' ||
    m === 'application/vnd.ms-word' ||
    m ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    m === 'application/vnd.ms-powerpoint' ||
    m ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    m === 'application/vnd.ms-excel' ||
    m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    m === 'application/vnd.ms-excel.sheet.macroenabled.12'
  );
}

export function utf8Decode(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function truncateText(
  s: string,
  max: number,
): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max), truncated: true };
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfJsPromise: Promise<PdfJs> | null = null;

/**
 * 2D affine stand-in for `DOMMatrix`. pdf.js builds one when its module loads
 * and polyfills it from `@napi-rs/canvas`, a native optional package a server
 * deployment may not ship. Text extraction never renders.
 */
class AffineMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: ArrayLike<number>) {
    if (init && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = [
        init[0] ?? 1,
        init[1] ?? 0,
        init[2] ?? 0,
        init[3] ?? 1,
        init[4] ?? 0,
        init[5] ?? 0,
      ];
    }
  }

  private set(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): this {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  multiplySelf(m: AffineMatrix): this {
    return this.set(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f,
    );
  }

  preMultiplySelf(m: AffineMatrix): this {
    const self = new AffineMatrix([
      this.a,
      this.b,
      this.c,
      this.d,
      this.e,
      this.f,
    ]);
    this.set(m.a, m.b, m.c, m.d, m.e, m.f);
    return this.multiplySelf(self);
  }

  translateSelf(tx = 0, ty = 0): this {
    return this.multiplySelf(new AffineMatrix([1, 0, 0, 1, tx, ty]));
  }

  scaleSelf(sx = 1, sy = sx): this {
    return this.multiplySelf(new AffineMatrix([sx, 0, 0, sy, 0, 0]));
  }

  invertSelf(): this {
    const det = this.a * this.d - this.b * this.c;
    if (!det) return this.set(NaN, NaN, NaN, NaN, NaN, NaN);
    return this.set(
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    );
  }
}

/**
 * pdf.js on the main thread: registering the worker module on `globalThis`
 * skips its fake-worker `import(workerSrc)`, which a server bundle cannot
 * resolve. Both imports stay literal so deployment tracing keeps the files.
 */
function loadPdfJs(): Promise<PdfJs> {
  pdfJsPromise ??= (async () => {
    const g = globalThis as { DOMMatrix?: unknown };
    g.DOMMatrix ??= AffineMatrix;
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  })().catch((error: unknown) => {
    pdfJsPromise = null;
    throw error;
  });
  return pdfJsPromise;
}

async function extractPdfTextWithPdfJs(
  bytes: Uint8Array,
  maxChars: number,
): Promise<string> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({
    // pdf.js may detach the buffer it is given; callers still need theirs.
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  try {
    const pages: string[] = [];
    let length = 0;
    for (let n = 1; n <= doc.numPages && length < maxChars; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        text += item.str;
        if (item.hasEOL) text += '\n';
      }
      page.cleanup();
      pages.push(text.trim());
      length += text.length;
    }
    return pages.filter(Boolean).join('\n\n').trim();
  } finally {
    await doc.destroy();
  }
}

async function extractPdfTextWithPdfParse(bytes: Uint8Array): Promise<string> {
  const requirePdf = createRequire(import.meta.url);
  const pdfParse = requirePdf('pdf-parse') as (
    data: Buffer,
  ) => Promise<{ text?: string }>;
  const data = await pdfParse(Buffer.from(bytes));
  return typeof data.text === 'string' ? data.text.trim() : '';
}

/**
 * Text layer of a PDF: '' when it has none (scanned), null when no reader
 * could parse it. pdf.js recovers broken cross-reference tables; the older
 * pdf-parse build is only a fallback.
 */
export async function extractPdfText(
  bytes: Uint8Array,
  { maxChars = ASSET_MAX_TEXT_CHARS }: { maxChars?: number } = {},
): Promise<string | null> {
  try {
    return await extractPdfTextWithPdfJs(bytes, maxChars);
  } catch (error) {
    console.warn('[extractPdfText] pdf.js could not read the PDF', error);
  }
  try {
    return await extractPdfTextWithPdfParse(bytes);
  } catch (error) {
    console.warn('[extractPdfText] pdf-parse could not read the PDF', error);
    return null;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
