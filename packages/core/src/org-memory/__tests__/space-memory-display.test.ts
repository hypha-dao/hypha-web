import { describe, expect, it } from 'vitest';
import {
  deriveSpaceMemoryDisplayTitle,
  looksLikeTechnicalSpaceMemoryName,
  stripTechnicalSpeakerFromExcerpt,
} from '../space-memory-display';

describe('looksLikeTechnicalSpaceMemoryName', () => {
  it('flags synthetic call artifact filenames and hashes', () => {
    expect(
      looksLikeTechnicalSpaceMemoryName('call-transcript-session-1.txt'),
    ).toBe(true);
    expect(
      looksLikeTechnicalSpaceMemoryName(
        'aaba40ddf5fc2f79a3b2f332479319b164169.webm',
      ),
    ).toBe(true);
    expect(
      looksLikeTechnicalSpaceMemoryName(
        '6MiOwFUJuAco8jasovTtxmqrbFV7No38vZBst2dA4lgwXT0y',
      ),
    ).toBe(true);
    expect(
      looksLikeTechnicalSpaceMemoryName(
        'prod_privy_did_privy_cmcj7opiz01vjju0mixu',
      ),
    ).toBe(true);
  });

  it('allows human-readable titles', () => {
    expect(looksLikeTechnicalSpaceMemoryName('Q2 planning sync')).toBe(false);
    expect(looksLikeTechnicalSpaceMemoryName('Budget proposal')).toBe(false);
  });
});

describe('stripTechnicalSpeakerFromExcerpt', () => {
  it('removes bridged privy speaker prefixes', () => {
    expect(
      stripTechnicalSpeakerFromExcerpt(
        'prod_privy_did_privy_abc: ok recording with voice only',
      ),
    ).toBe('ok recording with voice only');
  });

  it('removes full Matrix bridged speaker prefixes', () => {
    expect(
      stripTechnicalSpeakerFromExcerpt(
        '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud: ok recording with voice only',
      ),
    ).toBe('ok recording with voice only');
  });
});

describe('deriveSpaceMemoryDisplayTitle', () => {
  it('prefers signal context title for call artifacts', () => {
    expect(
      deriveSpaceMemoryDisplayTitle({
        source: 'call_recording',
        name: 'aaba40ddf5fc2f79a3b2f332479319b164169.webm',
        contextTitle: 'Improve onboarding flow',
      }),
    ).toBe('Improve onboarding flow');
  });

  it('derives title from transcript excerpt when filename is technical', () => {
    expect(
      deriveSpaceMemoryDisplayTitle({
        source: 'call_transcript',
        name: 'call-transcript-session-1.txt',
        textExcerpt:
          'prod_privy_did_privy_abc: ok recording with voice only and then shifting to video',
      }),
    ).toBe('ok recording with voice only and then shifting to video');
  });
});
