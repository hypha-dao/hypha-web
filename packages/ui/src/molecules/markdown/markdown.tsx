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
 */
const stripHtmlComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, '');

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
