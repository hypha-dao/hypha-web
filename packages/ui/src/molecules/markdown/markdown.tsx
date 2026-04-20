import { MDXRemote } from 'next-mdx-remote-client/rsc';
import type { MDXComponents } from 'mdx/types';
import { ComponentMap } from './content-map';
import { Suspense } from 'react';
import { ProseWrapper as DefaultProseWrapper } from './prose-wrapper';

type MarkdownProps = {
  children?: string;
  components?: MDXComponents;
  ProseWrapper?: React.ComponentType<{ children: React.ReactNode }>;
};

/**
 * MDX rejects HTML-style comments (`<!-- ... -->`) with a hard parser error,
 * which breaks the whole page when the source contains any. We use HTML
 * comments elsewhere as invisible data markers (e.g. escrow id anchors on
 * agreement descriptions), so strip them here before compilation. The
 * resulting text behaves the same way in both MDX and plain markdown renders.
 *
 * Implemented as a manual single-pass scanner instead of a regex to avoid
 * two CodeQL findings:
 *   - polynomial ReDoS on the lazy `[\s\S]*?` quantifier when input contains
 *     many `<!--` openers without a closing `-->`;
 *   - incomplete multi-character sanitization, where stripping a comment can
 *     reveal a new comment opener formed from already-emitted characters
 *     (e.g. `<!<!--x-->--y-->` collapsing into `<!--y-->`).
 *
 * The scanner is O(n) time / O(n) extra space and rewinds the output buffer
 * by up to two characters when a strip would create a fresh `<!--` boundary.
 */
const COMMENT_CLOSE = '-->';

const stripHtmlComments = (source: string): string => {
  const out: string[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    let popOut = 0;
    let consume = 0;

    if (
      out.length >= 2 &&
      out[out.length - 2] === '<' &&
      out[out.length - 1] === '!' &&
      source[i] === '-' &&
      source[i + 1] === '-'
    ) {
      popOut = 2;
      consume = 2;
    } else if (
      out.length >= 1 &&
      out[out.length - 1] === '<' &&
      source[i] === '!' &&
      source[i + 1] === '-' &&
      source[i + 2] === '-'
    ) {
      popOut = 1;
      consume = 3;
    } else if (
      source[i] === '<' &&
      source[i + 1] === '!' &&
      source[i + 2] === '-' &&
      source[i + 3] === '-'
    ) {
      consume = 4;
    } else {
      out.push(source.charAt(i));
      i++;
      continue;
    }

    const end = source.indexOf(COMMENT_CLOSE, i + consume);
    for (let k = 0; k < popOut; k++) out.pop();
    if (end === -1) {
      // Unterminated comment — drop it and the remainder.
      break;
    }
    i = end + COMMENT_CLOSE.length;
  }

  return out.join('');
};

export const Markdown = ({
  children = '',
  components = ComponentMap,
  ProseWrapper = DefaultProseWrapper,
}: MarkdownProps) => {
  return (
    <ProseWrapper>
      <MDXRemote source={stripHtmlComments(children)} components={components} />
    </ProseWrapper>
  );
};

export const MarkdownSuspense = ({
  children = '',
  components = ComponentMap,
  FallBack = <div>Loading...</div>,
}: MarkdownProps & { FallBack?: React.ReactNode }) => {
  return (
    <Suspense fallback={FallBack}>
      <Markdown components={components}>{children}</Markdown>
    </Suspense>
  );
};
