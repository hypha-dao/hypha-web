import { describe, expect, it } from 'vitest';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
  needsHyphaProfileResolutionForMatrixLabel,
  pickUserVisibleMemberLabel,
  speakerLabelToCanonicalPrivySub,
  splitSpeakerLabeledTranscriptLine,
} from '../matrix-member-display';

const PROD_MXID = '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud';

describe('pickUserVisibleMemberLabel', () => {
  it('returns the first non-technical candidate', () => {
    expect(
      pickUserVisibleMemberLabel(
        PROD_MXID,
        'prod_privy_did_privy_cmabc123',
        'Alex Prate',
      ),
    ).toBe('Alex Prate');
  });

  it('returns null when every candidate is a bridged Privy slug', () => {
    expect(
      pickUserVisibleMemberLabel(
        PROD_MXID,
        'prod_privy_did_privy_cmabc123',
        '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud',
      ),
    ).toBeNull();
  });
});

describe('looksLikeTechnicalMatrixDisplayName', () => {
  it('treats did:privy subs as technical display names', () => {
    expect(
      looksLikeTechnicalMatrixDisplayName(
        'did:privy:cmabc123',
        '@alice:matrix.org',
      ),
    ).toBe(true);
  });
});

describe('needsHyphaProfileResolutionForMatrixLabel', () => {
  it('requires Hypha lookup for did:privy display names', () => {
    expect(
      needsHyphaProfileResolutionForMatrixLabel('did:privy:cmabc123'),
    ).toBe(true);
  });
});

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
