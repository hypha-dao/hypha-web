import { describe, expect, it } from 'vitest';
import {
  CALL_PARTICIPANT_PROFILE_TIMEOUT_MS,
  matrixUserLocalpartFallback,
  resolveCallParticipantDisplayText,
  shouldShowCallParticipantNameSkeleton,
} from '../call-participant-display-name';

describe('matrixUserLocalpartFallback', () => {
  it('returns the Matrix localpart', () => {
    expect(matrixUserLocalpartFallback('@alice:matrix.org')).toBe('alice');
  });
});

describe('resolveCallParticipantDisplayText (WCUX-AUDIO-TILE-1)', () => {
  it('never returns blank for remote audio-only tiles', () => {
    expect(
      resolveCallParticipantDisplayText({
        isPip: false,
        isLocalFeed: false,
        currentUserId: null,
        syncLabel: '',
        personName: '',
        matrixUserId: '@bob:example.com',
        matrixMemberLabel: 'Bob Matrix',
        fallback: 'Participant',
      }),
    ).toBe('Bob Matrix');
  });

  it('falls back to localpart when labels are empty', () => {
    expect(
      resolveCallParticipantDisplayText({
        isPip: false,
        isLocalFeed: false,
        currentUserId: null,
        syncLabel: '',
        personName: '',
        matrixUserId: '@carol:example.com',
        matrixMemberLabel: '',
        fallback: '',
      }),
    ).toBe('carol');
  });

  it('skips did:privy subs until profile resolves', () => {
    expect(
      resolveCallParticipantDisplayText({
        isPip: false,
        isLocalFeed: false,
        currentUserId: null,
        syncLabel: 'did:privy:cmabc123',
        personName: '',
        matrixUserId: '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud',
        matrixMemberLabel: 'did:privy:cmabc123',
        fallback: 'Participant',
      }),
    ).toBe('Participant');
  });

  it('prefers Hypha person name when available', () => {
    expect(
      resolveCallParticipantDisplayText({
        isPip: false,
        isLocalFeed: false,
        currentUserId: null,
        syncLabel: 'prod_privy_did_privy_abc',
        personName: 'Carol Hypha',
        matrixUserId: '@carol:example.com',
        matrixMemberLabel: 'Carol Matrix',
        fallback: 'Participant',
      }),
    ).toBe('Carol Hypha');
  });

  it('skips bridged Privy slugs and uses fallback until profile resolves', () => {
    expect(
      resolveCallParticipantDisplayText({
        isPip: false,
        isLocalFeed: false,
        currentUserId: null,
        syncLabel: '@prod_privy…ha77ll:srv1294735.hstgr.cloud',
        personName: '',
        matrixUserId:
          '@prod_privy_did_privy_cmdj8gqv30011l80j8qha77ll:srv1294735.hstgr.cloud',
        matrixMemberLabel: '@prod_privy…ha77ll:srv1294735.hstgr.cloud',
        fallback: 'Screen share',
      }),
    ).toBe('Screen share');
  });

  it('shows resolved presenter name for share overlay once profile loads', () => {
    expect(
      resolveCallParticipantDisplayText({
        isPip: false,
        isLocalFeed: false,
        currentUserId: null,
        syncLabel: 'prod_privy_did_privy_abc',
        personName: 'Martin Prate',
        matrixUserId:
          '@prod_privy_did_privy_cmdj8gqv30011l80j8qha77ll:srv1294735.hstgr.cloud',
        matrixMemberLabel: '@prod_privy…ha77ll:srv1294735.hstgr.cloud',
        fallback: 'Screen share',
      }),
    ).toBe('Martin Prate');
  });
});

describe('shouldShowCallParticipantNameSkeleton (WCUX-AUDIO-TILE-2)', () => {
  it('never skeletons audio-only tiles while profile loads', () => {
    expect(
      shouldShowCallParticipantNameSkeleton({
        isPip: false,
        isShare: false,
        isAudioOnlyTile: true,
        needsProfile: true,
        loadingLink: true,
        loadingPerson: false,
        linkedSub: null,
        profileTimedOut: false,
      }),
    ).toBe(false);
  });

  it('still skeletons video tiles while profile loads', () => {
    expect(
      shouldShowCallParticipantNameSkeleton({
        isPip: false,
        isShare: false,
        isAudioOnlyTile: false,
        needsProfile: true,
        loadingLink: true,
        loadingPerson: false,
        linkedSub: null,
        profileTimedOut: false,
      }),
    ).toBe(true);
  });

  it('stops skeleton after profile timeout', () => {
    expect(
      shouldShowCallParticipantNameSkeleton({
        isPip: false,
        isShare: false,
        isAudioOnlyTile: false,
        needsProfile: true,
        loadingLink: true,
        loadingPerson: true,
        linkedSub: 'did:privy:abc',
        profileTimedOut: true,
      }),
    ).toBe(false);
  });
});

describe('CALL_PARTICIPANT_PROFILE_TIMEOUT_MS', () => {
  it('uses a 4 second profile resolution timeout', () => {
    expect(CALL_PARTICIPANT_PROFILE_TIMEOUT_MS).toBe(4000);
  });
});
