import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { AsteriskBold, UnderscoreUnderline } from './chat-markdown-marks';

/**
 * Document extensions the quest rich-text editor uses to parse and serialize.
 * Placeholder and paste handling are editor-only and do not change markdown.
 */
export function createRichTextDocumentExtensions() {
  return [
    StarterKit.configure({
      // Replaced by AsteriskBold / UnderscoreUnderline for chat-compatible __/ **.
      bold: false,
      underline: false,
      heading: { levels: [1, 2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      },
    }),
    AsteriskBold,
    UnderscoreUnderline,
  ];
}

let manager: MarkdownManager | null = null;

function richTextMarkdownManager(): MarkdownManager {
  if (!manager) {
    manager = new MarkdownManager({
      extensions: createRichTextDocumentExtensions(),
    });
  }
  return manager;
}

/**
 * Stable markdown for the quest editor.
 * `*x*` and `_x_` become italic and stay `*x*` on the next save.
 * Literal brackets are stored escaped so the editor reloads them as brackets.
 * A second call returns the same string.
 */
export function canonicalizeRichTextMarkdown(markdown: string): string {
  const trimmed = markdown.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  const parser = richTextMarkdownManager();
  const once = parser.serialize(parser.parse(trimmed)).trim();
  return parser.serialize(parser.parse(once)).trim();
}
