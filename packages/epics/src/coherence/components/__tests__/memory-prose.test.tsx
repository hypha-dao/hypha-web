import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MemoryProse } from '../memory-prose';

describe('MemoryProse', () => {
  it('renders headings, lists, bold, and inline code', () => {
    const html = renderToStaticMarkup(
      <MemoryProse
        source={`# Test mission

- item one
- **bold** item

Paragraph with \`code\`.`}
      />,
    );
    expect(html).toContain('Test mission');
    expect(html).toContain('item one');
    expect(html).toContain('<strong');
    expect(html).toContain('bold');
    expect(html).toContain('<code');
    expect(html).toContain('code');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
  });

  it('renders blockquotes, rules, and fenced code without raw markers', () => {
    const html = renderToStaticMarkup(
      <MemoryProse
        source={`Intro line
> Bias to **small**, shippable work.
> Ship weekly.

---

\`\`\`
pnpm dev
\`\`\`

1) First
+ Loose bullet`}
      />,
    );
    expect(html).toContain('<blockquote');
    expect(html).toContain('<strong');
    expect(html).toContain('Ship weekly.');
    expect(html).not.toContain('&gt;');
    expect(html).toContain('<hr');
    expect(html).toContain('<pre');
    expect(html).toContain('pnpm dev');
    expect(html).toContain('<ol');
    expect(html).toContain('<ul');
    expect(html).not.toContain('1)');
    expect(html).not.toContain('+ Loose');
  });
});
