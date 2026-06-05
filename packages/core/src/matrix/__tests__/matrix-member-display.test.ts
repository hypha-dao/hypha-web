import { describe, expect, it } from 'vitest';
import {
  matrixUserIdToCanonicalPrivySub,
  speakerLabelToCanonicalPrivySub,
  splitSpeakerLabeledTranscriptLine,
} from '../matrix-member-display';

describe('matrixUserIdToCanonicalPrivySub', () => {
  it('maps bridged prod localparts to did:privy subs', () => {
    expect(
      matrixUserIdToCanonicalPrivySub(
        '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud',
      ),
    ).toBe('did:privy:cmabc123');
  });

  it('returns null for non-bridged locals', () => {
    expect(matrixUserIdToCanonicalPrivySub('@alice:matrix.org')).toBeNull();
  });
});

describe('speakerLabelToCanonicalPrivySub', () => {
  it('maps bare prod localparts from call transcripts', () => {
    expect(
      speakerLabelToCanonicalPrivySub('prod_privy_did_privy_cmabc123'),
    ).toBe('did:privy:cmabc123');
  });
});

describe('splitSpeakerLabeledTranscriptLine', () => {
  it('splits after a full Matrix user id before the utterance', () => {
    expect(
      splitSpeakerLabeledTranscriptLine(
        '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud: ok recording with voice only',
      ),
    ).toEqual({
      speaker: '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud',
      body: ' ok recording with voice only',
    });
  });

  it('splits bare bridged localparts on the first colon', () => {
    expect(
      splitSpeakerLabeledTranscriptLine('prod_privy_did_privy_abc: hello team'),
    ).toEqual({
      speaker: 'prod_privy_did_privy_abc',
      body: ' hello team',
    });
  });
});
