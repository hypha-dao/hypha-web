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
export const Markdown = ({
  children = '',
  components = ComponentMap,
  ProseWrapper = DefaultProseWrapper,
}: MarkdownProps) => {
  return (
    <ProseWrapper>
      <MDXRemote source={children} components={components} />
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
