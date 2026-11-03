import { describe, expect, it } from 'vitest';
import {
  deriveSpaceMemoryDisplayTitle,
  humanizeMemoryExcerpt,
  looksLikeTechnicalSpaceMemoryName,
  memoryBodyWithoutRepeatedTitle,
  scrubTechnicalIdentityTokens,
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

describe('scrubTechnicalIdentityTokens', () => {
  it('removes bare bridged privy locals from free text', () => {
    expect(
      scrubTechnicalIdentityTokens('hello prod_privy_did_privy_cmabc123 there'),
    ).toBe('hello there');
  });
});

describe('humanizeMemoryExcerpt', () => {
  it('keeps the sentences from a Matrix reply dump', () => {
    expect(
      humanizeMemoryExcerpt(
        '> <@prod_privy_did_privy_cmjzf9wf03qyjp0cx3x2u2ob:srv1294735.hstgr.cloud> How was the call yesterday @prod_privy_did_privy_cmcj7opiz01vjju0mixu3rotw:srv1294735.hstgr.cloud> Did you notice any improvement, or still had issues during the call? > > The changes I made were mainly to be able to recover correctly when ther...',
      ),
    ).toBe(
      'How was the call yesterday Did you notice any improvement, or still had issues during the call? The changes I made were mainly to be able to recover correctly when ther...',
    );
  });

  it('strips bridged speakers from call transcript excerpts', () => {
    expect(
      humanizeMemoryExcerpt(
        'prod_privy_did_privy_abc: ok recording with voice only\nprod_privy_did_privy_def: then we switched to video',
      ),
    ).toBe('ok recording with voice only\nthen we switched to video');
  });

  it('leaves ordinary markdown alone', () => {
    const markdown = '## Notes\n\n- Keep the budget';
    expect(humanizeMemoryExcerpt(markdown)).toBe(markdown);
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

  it('falls back when the excerpt lead is URL spam', () => {
    expect(
      deriveSpaceMemoryDisplayTitle({
        source: 'discussion_summary',
        name: 'discussion-summary-1.md',
        textExcerpt:
          'Hypha call capture notice Hypha call capture notice https://pr.example/overview https://io.example/website',
      }),
    ).toBe('Conversation summary');
  });
});

describe('memoryBodyWithoutRepeatedTitle', () => {
  it('strips a title that was derived from the opening of the body', () => {
    const body =
      'We aligned on shipping the memory timeline next. Then we reviewed recordings.';
    expect(
      memoryBodyWithoutRepeatedTitle(
        'We aligned on shipping the memory timeline next.',
        body,
      ),
    ).toBe('Then we reviewed recordings.');
  });

  it('strips a truncated title that ends with an ellipsis', () => {
    const body =
      'Hypha call capture notice https://example.com/overview and more notes.';
    expect(
      memoryBodyWithoutRepeatedTitle(
        'Hypha call capture notice https://example.com/overvi…',
        body,
      ),
    ).toBe('and more notes.');
  });

  it('returns empty when title and body are the same sentence', () => {
    expect(
      memoryBodyWithoutRepeatedTitle(
        'Short summary only.',
        'Short summary only.',
      ),
    ).toBe('');
  });

  it('leaves unrelated bodies intact', () => {
    expect(
      memoryBodyWithoutRepeatedTitle(
        'Hypha Core Team',
        'Notes from the weekly sync.',
      ),
    ).toBe('Notes from the weekly sync.');
  });
});
