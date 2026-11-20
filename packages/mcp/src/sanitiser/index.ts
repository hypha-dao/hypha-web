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

const IMAGE_MD = /!\[([^\]]*)\]\([^)]*\)/g;
const IMAGE_REF = /!\[([^\]]*)\]\[[^\]]*\]/g;
// Shortcut reference image `![alt]` (its target lives in a definition line elsewhere).
const IMAGE_SHORTCUT = /!\[([^\]\n]*)\](?!\s*[[(])/g;
// Reference definitions `[label]: target "title"`, which carry the target of a reference.
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[[^\]\n]+\]:[^\n]*$/gm;
// Protocol-relative URL (`//host/path`) at a word start.
const PROTOCOL_RELATIVE = /(^|[\s(<])\/\/[^\s<>"')\]]+/g;
const IMAGE_HTML = /<img\b[^>]*>/gi;
const LINK_MD = /\[([^\]]*)\]\(\s*(?:https?:|\/\/|data:|javascript:)[^)]*\)/gi;
const RAW_URL =
  /\b(?:https?:\/\/|ftp:\/\/|data:)[^\s<>"')\]]+|\bwww\.[^\s<>"')\]]+/gi;

export type Sanitised = { text: string; truncated: boolean };

export function sanitiseUserText(
  input: string | null | undefined,
  maxLength: number,
): Sanitised {
  if (!input) return { text: '', truncated: false };
  let text = input
    .replace(/\r\n?/g, '\n')
    .replace(LINE_SEPARATORS, '\n')
    .replace(INVISIBLE, '')
    .replace(CONTROL, '')
    .replace(IMAGE_MD, (_m, alt: string) =>
      alt ? `[image: ${alt}]` : '[image]',
    )
    .replace(IMAGE_REF, (_m, alt: string) =>
      alt ? `[image: ${alt}]` : '[image]',
    )
    .replace(REFERENCE_DEFINITION, '')
    .replace(IMAGE_SHORTCUT, (_m, alt: string) =>
      alt ? `[image: ${alt}]` : '[image]',
    )
    .replace(IMAGE_HTML, '[image]')
    .replace(LINK_MD, (_m, label: string) => `${label} [link removed]`)
    .replace(RAW_URL, '[link removed]')
    .replace(PROTOCOL_RELATIVE, '$1[link removed]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const points = Array.from(text);
  if (points.length <= maxLength) return { text, truncated: false };
  text = points.slice(0, maxLength).join('').trimEnd();
  return { text, truncated: true };
}
