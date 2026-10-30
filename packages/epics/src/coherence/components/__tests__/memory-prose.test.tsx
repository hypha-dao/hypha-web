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

  it('keeps a fenced block open until a bare closing fence', () => {
    const html = renderToStaticMarkup(
      <MemoryProse
        source={`\`\`\`md
first
\`\`\`example
still code
\`\`\`
After the block.`}
      />,
    );
    expect(html.match(/<pre/g)).toHaveLength(1);
    expect(html).toContain('```example\nstill code');
    expect(html).toMatch(/<\/pre><p[^>]*>After the block\.<\/p>/);
  });

  it('caps blockquote nesting and renders deeper levels flat', () => {
    const html = renderToStaticMarkup(
      <MemoryProse source={`${'>'.repeat(40)} deep thought`} />,
    );
    expect(html.match(/<blockquote/g)).toHaveLength(8);
    expect(html).toContain('deep thought');
    expect(html).not.toContain('&gt;');
  });
});
