import { describe, expect, it } from 'vitest';
import { schemaCreateCoherenceForm } from '../validation';

const baseSignal = {
  type: 'Need' as const,
  priority: 'medium' as const,
  title: 'Winter seed',
  description: 'We need seed for the greenhouse.',
  creatorId: 1,
  spaceId: 1,
  archived: false,
};

describe('indicative payouts on a signal', () => {
  it('treats a missing amount list as none', () => {
    const parsed = schemaCreateCoherenceForm.parse(baseSignal);
    expect(parsed.indicativePayouts).toEqual([]);
  });

  it('drops a blank starter row', () => {
    const parsed = schemaCreateCoherenceForm.parse({
      ...baseSignal,
      indicativePayouts: [{ amount: '', token: '' }],
    });
    expect(parsed.indicativePayouts).toEqual([]);
  });

  it('keeps a filled amount and token address', () => {
    const parsed = schemaCreateCoherenceForm.parse({
      ...baseSignal,
      indicativePayouts: [
        {
          amount: '250',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        },
      ],
    });
    expect(parsed.indicativePayouts).toEqual([
      {
        amount: '250',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
    ]);
  });

  it('keeps an image, a video link, and a document', () => {
    const parsed = schemaCreateCoherenceForm.parse({
      ...baseSignal,
      leadImage: 'https://cdn.example.com/seed.jpg',
      videoUrl: 'https://www.youtube.com/watch?v=abc123',
      attachments: [
        { name: 'Brief.pdf', url: 'https://cdn.example.com/brief.pdf' },
      ],
    });
    expect(parsed.leadImage).toBe('https://cdn.example.com/seed.jpg');
    expect(parsed.videoUrl).toBe('https://www.youtube.com/watch?v=abc123');
    expect(parsed.attachments).toEqual([
      { name: 'Brief.pdf', url: 'https://cdn.example.com/brief.pdf' },
    ]);
  });

  it('rejects a video link that is not a web address', () => {
    const result = schemaCreateCoherenceForm.safeParse({
      ...baseSignal,
      videoUrl: 'not-a-link',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an amount without a token', () => {
    const result = schemaCreateCoherenceForm.safeParse({
      ...baseSignal,
      indicativePayouts: [{ amount: '10', token: '' }],
    });
    expect(result.success).toBe(false);
  });
});
