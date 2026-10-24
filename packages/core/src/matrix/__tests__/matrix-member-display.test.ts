import { afterEach, describe, expect, it } from 'vitest';
import {
  countHumanMatrixMembers,
  isHyphaBotMatrixIdentity,
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
  needsHyphaProfileResolutionForMatrixLabel,
  pickUserVisibleMemberLabel,
  resolveBridgedLocalHandleToMxid,
  uniqueCanonicalPrivySubsFromMxids,
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
    const previous = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID;
    process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID =
      '@hypha_bot_prod:matrix.hypha.earth';
    try {
      expect(
        pickUserVisibleMemberLabel(
          '@hypha_bot_prod:matrix.hypha.earth',
          'hypha_bot_prod',
        ),
      ).toBeNull();
    } finally {
      if (previous == null) delete process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID;
      else process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID = previous;
    }
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

describe('uniqueCanonicalPrivySubsFromMxids', () => {
  it('dedupes bridged prod locals', () => {
    expect(
      uniqueCanonicalPrivySubsFromMxids([
        PROD_MXID,
        PROD_MXID,
        '@alice:matrix.org',
        '  ',
      ]),
    ).toEqual(['did:privy:cmabc123']);
  });
});

describe('resolveBridgedLocalHandleToMxid', () => {
  it('prefers a joined member with the same localpart', () => {
    expect(
      resolveBridgedLocalHandleToMxid('prod_privy_did_privy_cmabc123', [
        PROD_MXID,
      ]),
    ).toBe(PROD_MXID);
  });

  it('synthesizes an MXID so person lookup can run', () => {
    expect(
      resolveBridgedLocalHandleToMxid('prod_privy_did_privy_cmabc123'),
    ).toBe('@prod_privy_did_privy_cmabc123:matrix');
    expect(resolveBridgedLocalHandleToMxid('alice')).toBeNull();
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
  const previousPublicExtra =
    process.env.NEXT_PUBLIC_HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;

  afterEach(() => {
    if (previousPrimary == null)
      delete process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID;
    else process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID = previousPrimary;
    if (previousExtra == null) {
      delete process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    } else {
      process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS = previousExtra;
    }
    if (previousPublicExtra == null) {
      delete process.env.NEXT_PUBLIC_HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    } else {
      process.env.NEXT_PUBLIC_HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS =
        previousPublicExtra;
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

  it('reads additional bot IDs from the client-safe NEXT_PUBLIC_ variable', () => {
    process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID = '@hypha-bot:hypha.earth';
    delete process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    process.env.NEXT_PUBLIC_HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS =
      '@hypha-bot-preview:hypha.earth';
    expect(
      countHumanMatrixMembers([
        '@ada:hypha.earth',
        '@hypha-bot:hypha.earth',
        '@hypha-bot-preview:hypha.earth',
        '@kate:hypha.earth',
      ]),
    ).toBe(2);
  });

  it('counts a remote hypha_bot-named account as a person', () => {
    process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID = '@hypha-bot:hypha.earth';
    delete process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    delete process.env.NEXT_PUBLIC_HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    expect(isHyphaBotMatrixIdentity('@hypha_bot_eve:remote.example')).toBe(
      false,
    );
    expect(
      countHumanMatrixMembers([
        '@ada:hypha.earth',
        '@hypha_bot_eve:remote.example',
      ]),
    ).toBe(2);
  });

  it('trusts the shared Dendrite prod and preview bots without extra env', () => {
    delete process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID;
    delete process.env.HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    delete process.env.NEXT_PUBLIC_HYPHA_MATRIX_ADDITIONAL_BOT_USER_IDS;
    expect(isHyphaBotMatrixIdentity('@hypha_bot_prod:matrix.hypha.earth')).toBe(
      true,
    );
    expect(
      isHyphaBotMatrixIdentity('@hypha_bot_preview:matrix.hypha.earth'),
    ).toBe(true);
    expect(
      countHumanMatrixMembers([
        '@ada:matrix.hypha.earth',
        '@hypha_bot_prod:matrix.hypha.earth',
        '@hypha_bot_preview:matrix.hypha.earth',
        '@kate:matrix.hypha.earth',
      ]),
    ).toBe(2);
  });
});
