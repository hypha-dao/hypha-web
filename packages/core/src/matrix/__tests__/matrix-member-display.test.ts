import { afterEach, describe, expect, it } from 'vitest';
import {
  countHumanMatrixMembers,
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
  needsHyphaProfileResolutionForMatrixLabel,
  pickUserVisibleMemberLabel,
  visibleMatrixMemberName,
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

  it('hides the production bot account name', () => {
    expect(
      pickUserVisibleMemberLabel(
        '@hypha_bot_prod:matrix.hypha.earth',
        'hypha_bot_prod',
      ),
    ).toBeNull();
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

describe('visibleMatrixMemberName', () => {
  it('falls back to a shortened id when every candidate is a Privy slug', () => {
    expect(
      visibleMatrixMemberName(
        PROD_MXID,
        'prod_privy_did_privy_cmabc123',
        PROD_MXID,
      ),
    ).toBe('@prod_privy…abc123:srv1294735.hstgr.cloud');
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

describe('countHumanMatrixMembers', () => {
  const previousPrimary = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID;
  const previousExtra = process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;

  afterEach(() => {
    if (previousPrimary == null)
      delete process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID;
    else process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID = previousPrimary;
    if (previousExtra == null) {
      delete process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    } else {
      process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS = previousExtra;
    }
  });

  it('drops the configured bot, extra bots, and Hypha bot identities', () => {
    process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID = '@hypha-bot:hypha.earth';
    process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS =
      '@hypha-bot-preview:hypha.earth';
    expect(
      countHumanMatrixMembers([
        '@ada:hypha.earth',
        '@hypha-bot:hypha.earth',
        '@hypha-bot-preview:hypha.earth',
        '@hypha_bot_prod:hypha.earth',
        '@kate:hypha.earth',
      ]),
    ).toBe(2);
  });
});
