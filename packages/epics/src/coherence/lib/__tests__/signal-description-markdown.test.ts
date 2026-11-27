import { describe, expect, it } from 'vitest';
import { prepareSignalDescriptionMarkdown } from '../../utils/signal-description-markdown';

describe('prepareSignalDescriptionMarkdown', () => {
  it('keeps an intro, tightens numbered items, and emphasises short labels', () => {
    const input = [
      'Signals need these things:',
      '1. Visual context – Images that make signals more tangible.',
      '',
      '2. Essential filters – Simple ways to discover signals.',
      '',
      '3\\. Meaningful AI – Intelligence that helps interpret signals.',
      '4. Link to quest - from a signal we should create a quest.',
    ].join('\n');

    expect(prepareSignalDescriptionMarkdown(input)).toBe(
      [
        'Signals need these things:',
        '',
        '1. **Visual context** – Images that make signals more tangible.',
        '2. **Essential filters** – Simple ways to discover signals.',
        '3. **Meaningful AI** – Intelligence that helps interpret signals.',
        '4. **Link to quest** – from a signal we should create a quest.',
      ].join('\n'),
    );
  });

  it('leaves fenced and indented code unchanged', () => {
    const input = [
      'Steps:',
      '```',
      '1. Step - literal',
      '```',
      '    2. Also literal - keep',
    ].join('\n');

    expect(prepareSignalDescriptionMarkdown(input)).toBe(input);
  });

  it('leaves ordinary paragraphs alone', () => {
    expect(
      prepareSignalDescriptionMarkdown(
        'Just a short note about the neighbourhood heat pumps.',
      ),
    ).toBe('Just a short note about the neighbourhood heat pumps.');
  });
});
