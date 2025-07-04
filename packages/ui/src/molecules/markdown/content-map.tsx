import slugify from 'slugify';
import type { MDXComponents } from 'mdx/types';

export const ComponentMap: MDXComponents = {
  h1: ({ children }: { children: React.ReactNode }) => (
    <h1
      className="text-4xl font-bold text-neutral-11"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h1>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2
      className="text-3xl font-bold text-neutral-11"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h2>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <h3
      className="text-2xl font-bold text-neutral-11"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h3>
  ),
  h4: ({ children }: { children: React.ReactNode }) => (
    <h4
      className="text-xl font-bold text-neutral-11"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </h4>
  ),
  p: ({ children }: { children: React.ReactNode }) => (
    <p
      className="text-1 text-neutral-11"
      id={typeof children === 'string' ? slugify(children) : undefined}
    >
      {children}
    </p>
  ),
};
