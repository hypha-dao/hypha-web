import { describe, expect, it } from 'vitest';

import { signalListImage, splitSignalMedia } from '../../utils/signal-media';

describe('signalListImage', () => {
  it('prefers the lead image', () => {
    expect(
      signalListImage({
        leadImage: 'https://cdn.example.com/lead.jpg',
        attachments: [
          { name: 'other.png', url: 'https://cdn.example.com/other.png' },
        ],
      }),
    ).toBe('https://cdn.example.com/lead.jpg');
  });

  it('keeps lead priority when the lead is also later in attachments', () => {
    expect(
      signalListImage({
        leadImage: 'https://cdn.example.com/lead.jpg',
        attachments: [
          { name: 'other.png', url: 'https://cdn.example.com/other.png' },
          { name: 'lead.jpg', url: 'https://cdn.example.com/lead.jpg' },
        ],
      }),
    ).toBe('https://cdn.example.com/lead.jpg');
    expect(
      splitSignalMedia({
        leadImage: 'https://cdn.example.com/lead.jpg',
        attachments: [
          { name: 'other.png', url: 'https://cdn.example.com/other.png' },
          { name: 'lead.jpg', url: 'https://cdn.example.com/lead.jpg' },
        ],
      }).images.map((item) => item.url),
    ).toEqual([
      'https://cdn.example.com/lead.jpg',
      'https://cdn.example.com/other.png',
    ]);
  });

  it('uses the first image attachment when there is no lead image', () => {
    expect(
      signalListImage({
        leadImage: null,
        attachments: [
          { name: 'notes.pdf', url: 'https://cdn.example.com/notes.pdf' },
          { name: 'roof.jpg', url: 'https://cdn.example.com/roof.jpg' },
        ],
      }),
    ).toBe('https://cdn.example.com/roof.jpg');
  });

  it('skips a rejected lead and uses the first safe attachment', () => {
    expect(
      signalListImage({
        leadImage: 'javascript:alert(1)',
        attachments: [
          { name: 'roof.jpg', url: 'https://cdn.example.com/roof.jpg' },
        ],
      }),
    ).toBe('https://cdn.example.com/roof.jpg');
  });

  it('uses the space banner when the signal has no safe image', () => {
    expect(
      signalListImage(
        { leadImage: null, attachments: [] },
        'https://cdn.example.com/banner.jpg',
      ),
    ).toBe('https://cdn.example.com/banner.jpg');
    expect(
      signalListImage(
        { leadImage: 'https://cdn.example.com/lead.jpg' },
        'https://cdn.example.com/banner.jpg',
      ),
    ).toBe('https://cdn.example.com/lead.jpg');
    expect(
      signalListImage(
        { leadImage: null },
        '/placeholder/space-lead-image.webp',
      ),
    ).toBeNull();
  });

  it('returns nothing when the signal has no safe image', () => {
    expect(
      signalListImage({
        leadImage: 'javascript:alert(1)',
        attachments: [],
      }),
    ).toBeNull();
    expect(signalListImage({ leadImage: null, attachments: [] })).toBeNull();
  });
});
