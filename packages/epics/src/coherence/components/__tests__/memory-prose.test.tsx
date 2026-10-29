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
});
