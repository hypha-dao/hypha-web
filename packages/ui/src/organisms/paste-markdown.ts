import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { looksLikeMarkdown } from '@hypha-platform/ui-utils';

/**
 * When the clipboard plain text looks like Markdown, parse it via TipTap's
 * Markdown manager instead of inserting raw source (or competing HTML).
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
            if (!text || !looksLikeMarkdown(text)) {
              return false;
            }

            if (!editor.markdown) {
              return false;
            }

            try {
              const json = editor.markdown.parse(text);
              editor.commands.insertContent(json);
              return true;
            } catch {
              return false;
            }
          },
        },
      }),
    ];
  },
});
