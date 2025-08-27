import slugify from 'slugify';
import type { MDXComponents } from 'mdx/types';

export const ComponentMap: MDXComponents = {
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1
      className="text-4xl font-bold text-neutral-11 mt-6 mb-2"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2
      className="text-3xl font-bold text-neutral-11 mt-5 mb-2"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3
      className="text-2xl font-bold text-neutral-11 mt-4 mb-2"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h3>
  ),
  h4: ({ children }: { children: React.ReactNode }) => (
    <h4
      className="text-xl font-bold text-neutral-11 mt-3 mb-2"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h4>
  ),
  h5: ({ children }: { children: React.ReactNode }) => (
    <h5
      className="text-lg font-bold text-neutral-11 mt-3 mb-2"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h5>
  ),
  h6: ({ children }: { children: React.ReactNode }) => (
    <h6
      className="text-base font-bold text-neutral-11 mt-3 mb-2"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h6>
  ),
  p: ({ children }: { children: React.ReactNode }) => (
    <p
      className="text-base text-neutral-11 my-2"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </p>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="list-disc list-outside pl-4 my-2 ml-0 text-neutral-11">
      {children}
    </ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="list-decimal list-outside pl-4 my-2 ml-0 text-neutral-11">
      {children}
    </ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => (
    <li className="my-1 text-neutral-11">{children}</li>
  ),
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="border-l-4 border-neutral-6 pl-4 my-2 italic text-neutral-10">
      {children}
    </blockquote>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="font-bold text-neutral-11">{children}</strong>
  ),
  em: ({ children }: { children: React.ReactNode }) => (
    <em className="italic text-neutral-11">{children}</em>
  ),
  u: ({ children }: { children: React.ReactNode }) => (
    <u className="underline text-neutral-11">{children}</u>
  ),
};
