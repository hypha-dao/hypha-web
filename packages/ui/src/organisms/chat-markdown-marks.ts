import type { MarkdownLexerConfiguration, MarkdownToken } from '@tiptap/core';
import { Bold } from '@tiptap/extension-bold';
import { Underline } from '@tiptap/extension-underline';

/**
 * Chat / Discord-style markup uses `__text__` for underline and `**text**` for
 * bold. TipTap's defaults map `__` to bold (CommonMark) and `++` to underline.
 * These extensions align TipTap Markdown with chat-markup.ts.
 */
export const AsteriskBold = Bold.extend({
  name: 'bold',

  renderMarkdown(node, helpers) {
    return `**${helpers.renderChildren(node)}**`;
  },

  markdownTokenizer: {
    name: 'strong',
    level: 'inline',
    start(src: string) {
      return src.indexOf('**');
    },
    tokenize(
      src: string,
      _tokens: MarkdownToken[],
      lexer: MarkdownLexerConfiguration,
    ): MarkdownToken | undefined {
      const match = /^(\*\*)([\s\S]+?)(\*\*)/.exec(src);
      if (!match) return undefined;
      const innerContent = match[2]!.trim();
      return {
        type: 'strong',
        raw: match[0],
        text: innerContent,
        tokens: lexer.inlineTokens(innerContent),
      };
    },
  },
});

export const UnderscoreUnderline = Underline.extend({
  name: 'underline',

  renderMarkdown(node, helpers) {
    return `__${helpers.renderChildren(node)}__`;
  },

  markdownTokenizer: {
    name: 'underline',
    level: 'inline',
    start(src: string) {
      return src.indexOf('__');
    },
    tokenize(
      src: string,
      _tokens: MarkdownToken[],
      lexer: MarkdownLexerConfiguration,
    ): MarkdownToken | undefined {
      const match = /^(__)([\s\S]+?)(__)/.exec(src);
      if (!match) return undefined;
      const innerContent = match[2]!.trim();
      return {
        type: 'underline',
        raw: match[0],
        text: innerContent,
        tokens: lexer.inlineTokens(innerContent),
      };
    },
  },
});
