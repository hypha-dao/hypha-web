/**
 * Sanitiser for text written by Hypha users before it reaches an assistant (aspect: prompt
 * injection and exfiltration). It does not make the text safe to obey; it removes the
 * channels that hide or leak: invisible characters, markdown/HTML images and links, raw URLs.
 * The trusted `url` fields of items are built by the server and are not passed through here.
 */

// Built from code points (not literal characters) so the source stays readable and safe.
const cp = (n: number) => '\\u{' + n.toString(16) + '}';
const range = (from: number, to?: number) =>
  to === undefined ? cp(from) : cp(from) + '-' + cp(to);

// C0/C1 controls except tab and newline.
const CONTROL = new RegExp(
  '[' +
    [range(0, 8), range(0xb, 0xc), range(0xe, 0x1f), range(0x7f, 0x9f)].join(
      '',
    ) +
    ']',
  'gu',
);
// Zero-width, bidi controls and overrides, soft hyphen, word joiner family, BOM, combining
// grapheme joiner, Mongolian vowel separator, Hangul fillers and the Unicode tag block.
const INVISIBLE = new RegExp(
  '[' +
    [
      range(0xad),
      range(0x34f),
      range(0x61c),
      range(0x115f, 0x1160),
      range(0x17b4, 0x17b5),
      range(0x180b, 0x180e),
      range(0x200b, 0x200f),
      range(0x202a, 0x202e),
      range(0x2060, 0x206f),
      range(0x3164),
      range(0xfeff),
      range(0xffa0),
      range(0xe0000, 0xe007f),
    ].join('') +
    ']',
  'gu',
);
const LINE_SEPARATORS = new RegExp('[' + range(0x2028, 0x2029) + ']', 'gu');

const IMAGE_REF = /!\[([^\]]*)\]\[[^\]]*\]/g;
// Shortcut reference image `![alt]` (its target lives in a definition line elsewhere).
const IMAGE_SHORTCUT = /!\[([^\]\n]*)\](?!\s*[[(])/g;
// Reference definitions `[label]: target "title"`, which carry the target of a reference.
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[[^\]\n]+\]:[^\n]*$/gm;
// Protocol-relative URL (`//host/path`) at a word start.
const PROTOCOL_RELATIVE = /(^|[\s(<])\/\/[^\s<>"')\]]+/g;
const IMAGE_HTML = /<img\b[^>]*>/gi;
const RAW_URL =
  /\b(?:https?:\/\/|ftp:\/\/|data:)[^\s<>"')\]]+|\bwww\.[^\s<>"')\]]+/gi;

export type Sanitised = { text: string; truncated: boolean };

/** Index of the bracket or parenthesis that closes the one at `open` (balanced), or -1. */
function matchClose(
  text: string,
  open: number,
  left: string,
  right: string,
): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      i++; // skip an escaped character
    } else if (ch === left) {
      depth++;
    } else if (ch === right) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Removes every inline link and image destination, whatever its scheme (a destination can hide
 * its scheme behind a character reference, which Markdown decodes) and with balanced brackets
 * and parentheses in the label or destination. The label (or image alt text) stays, readable.
 */
function stripInlineLinks(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      const close = matchClose(text, i, '[', ']');
      if (close !== -1 && text[close + 1] === '(') {
        const end = matchClose(text, close + 1, '(', ')');
        if (end !== -1) {
          const label = stripInlineLinks(text.slice(i + 1, close));
          if (out.endsWith('!')) {
            out = out.slice(0, -1) + (label ? `(image: ${label})` : '(image)');
          } else {
            out += `${label} (link removed)`;
          }
          i = end + 1;
          continue;
        }
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

const LEFT_ANGLE = String.fromCodePoint(0x2039); // single left-pointing angle quotation mark
const RIGHT_ANGLE = String.fromCodePoint(0x203a);

/**
 * The hard guarantee. Every Markdown link, image and reference form needs square brackets, and
 * autolinks and raw HTML need angle brackets. After the readable replacements below, none of
 * these characters survives, so no link, image or reference can be rebuilt from what is left
 * (encoded destinations, block quotes, balanced brackets, definitions elsewhere in the text).
 */
function neutraliseMarkup(text: string): string {
  return text
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/</g, LEFT_ANGLE)
    .replace(/>/g, RIGHT_ANGLE);
}

export function sanitiseUserText(
  input: string | null | undefined,
  maxLength: number,
): Sanitised {
  if (!input) return { text: '', truncated: false };
  // Bound the work: nothing past this can survive the final cap anyway.
  const cap = maxLength * 4 + 200;
  const cut = input.length > cap;
  const bounded = cut ? input.slice(0, cap) : input;
  // Readable replacements first (they keep alt texts and labels); markers use parentheses
  // only, never brackets.
  let text = bounded
    .replace(/\r\n?/g, '\n')
    .replace(LINE_SEPARATORS, '\n')
    .replace(INVISIBLE, '')
    .replace(CONTROL, '');
  text = stripInlineLinks(text)
    .replace(IMAGE_REF, (_m, alt: string) =>
      alt ? `(image: ${alt})` : '(image)',
    )
    .replace(REFERENCE_DEFINITION, '')
    .replace(IMAGE_SHORTCUT, (_m, alt: string) =>
      alt ? `(image: ${alt})` : '(image)',
    )
    .replace(IMAGE_HTML, '(image)')
    .replace(RAW_URL, '(link removed)')
    .replace(PROTOCOL_RELATIVE, '$1(link removed)');
  text = neutraliseMarkup(text)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const points = Array.from(text);
  if (points.length <= maxLength) return { text, truncated: cut };
  text = points.slice(0, maxLength).join('').trimEnd();
  return { text, truncated: true };
}
