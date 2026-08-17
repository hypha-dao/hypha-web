import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { looksLikeMarkdown } from '@hypha-platform/ui-utils';

function firstDroppedUri(data: DataTransfer): string | null {
  const uriList = data.getData('text/uri-list');
  if (uriList) {
    const lines = uriList.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) return trimmed;
    }
  }
  const plain = data.getData('text/plain').trim();
  if (!plain || /\s/.test(plain)) return null;
  if (
    plain.startsWith('https://') ||
    plain.startsWith('http://') ||
    plain.startsWith('www.')
  ) {
    return plain;
  }
  return null;
}

function normalizeDroppedHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  const lower = href.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return null;
  }
  if (lower.startsWith('www.')) return `https://${href}`;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return href;
  return null;
}

function insertMarkdownOrLink(
  editor: {
    markdown?: { parse: (text: string) => unknown };
    commands: { insertContent: (value: unknown) => boolean };
  },
  text: string,
  href: string | null,
): boolean {
  if (text && looksLikeMarkdown(text) && editor.markdown) {
    try {
      const json = editor.markdown.parse(text);
      editor.commands.insertContent(json);
      return true;
    } catch {
      return false;
    }
  }
  if (!href) return false;
  const display = text.trim() || href;
  editor.commands.insertContent({
    type: 'text',
    text: display.startsWith('www.') ? href : display,
    marks: [{ type: 'link', attrs: { href } }],
  });
  return true;
}

/**
 * When the clipboard or drop payload looks like Markdown, parse it via TipTap's
 * Markdown manager instead of inserting raw source (or competing HTML).
 * Bare URLs become link marks so they match `[title](url)` in the editor.
 */
export const PasteMarkdown = Extension.create({
  name: 'pasteMarkdown',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('hyphaPasteMarkdown'),
        props: {
          handlePaste(_view, event) {
            const clipboard = event.clipboardData;
            if (!clipboard) return false;

            const text = clipboard.getData('text/plain');
            const href = firstDroppedUri(clipboard);
            if (!text && !href) return false;
            if (!looksLikeMarkdown(text) && !href) return false;
            if (!editor.markdown && !href) return false;

            return insertMarkdownOrLink(
              editor,
              text,
              href ? normalizeDroppedHref(href) : null,
            );
          },
          handleDrop(_view, event) {
            const data = event.dataTransfer;
            if (!data) return false;
            if (data.files?.length) return false;

            const text = data.getData('text/plain');
            const href = firstDroppedUri(data);
            if (!looksLikeMarkdown(text) && !href) return false;

            const ok = insertMarkdownOrLink(
              editor,
              text,
              href ? normalizeDroppedHref(href) : null,
            );
            if (ok) event.preventDefault();
            return ok;
          },
        },
      }),
    ];
  },
});
