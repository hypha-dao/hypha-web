import { describe, expect, it, vi } from 'vitest';
import {
  WEB_CONSENT_MAX_AGE_MS,
  CONSENT_MISMATCH,
  CONSENT_REQUIRED,
  CONSENT_STALE,
  signVoteWithExplicitConsent,
  signVoteWithWalletPrompt,
} from '../vote-signing';
import {
  recordUserExplicitConsent,
  type UserExplicitConsent,
} from '../user-explicit-consent';

const HASH = `0x${'ab'.repeat(32)}` as const;
const CONTRACT = `0x${'12'.repeat(20)}` as const;
const T0 = 1_700_000_000_000;

const setup = () => {
  const sendTransaction = vi.fn().mockResolvedValue(HASH);
  return {
    sendTransaction,
    input: (proposalId = 7, support = true) => ({
      signer: { sendTransaction },
      contractAddress: CONTRACT,
      proposalId,
      support,
    }),
  };
};

const consentFor = (proposalId = 7, support = true, now = T0) =>
  recordUserExplicitConsent({
    source: 'integration-approval',
    operation: 'vote',
    subject: proposalId,
    support,
    actionId: 'action-1',
    now,
  });

describe('signVoteWithExplicitConsent', () => {
  it('refuses a consent that was not recorded by the factory', () => {
    const { input, sendTransaction } = setup();
    const forged = {
      source: 'integration-approval',
      operation: 'vote',
      subject: 7,
      support: true,
      recordedAt: T0,
    } as unknown as UserExplicitConsent;
    expect(() => signVoteWithExplicitConsent(input(), forged, T0)).toThrow(
      CONSENT_REQUIRED,
    );
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('refuses a missing consent', () => {
    const { input, sendTransaction } = setup();
    expect(() =>
      signVoteWithExplicitConsent(
        input(),
        undefined as unknown as UserExplicitConsent,
        T0,
      ),
    ).toThrow(CONSENT_REQUIRED);
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('refuses a stale consent', () => {
    const { input, sendTransaction } = setup();
    expect(() =>
      signVoteWithExplicitConsent(
        input(),
        consentFor(),
        T0 + WEB_CONSENT_MAX_AGE_MS + 1,
      ),
    ).toThrow(CONSENT_STALE);
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('refuses a mismatching proposal id', () => {
    const { input, sendTransaction } = setup();
    expect(() =>
      signVoteWithExplicitConsent(input(8), consentFor(7), T0),
    ).toThrow(CONSENT_MISMATCH);
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('refuses a mismatching choice', () => {
    const { input, sendTransaction } = setup();
    expect(() =>
      signVoteWithExplicitConsent(input(7, false), consentFor(7, true), T0),
    ).toThrow(CONSENT_MISMATCH);
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('signs a fresh, matching consent with the provider modal hidden', async () => {
    const { input, sendTransaction } = setup();
    await expect(
      signVoteWithExplicitConsent(input(), consentFor(), T0 + 5_000),
    ).resolves.toBe(HASH);
    expect(sendTransaction).toHaveBeenCalledTimes(1);
    const [tx, options] = sendTransaction.mock.calls[0];
    expect(tx.to).toBe(CONTRACT);
    expect(tx.value).toBe(0n);
    expect(options).toEqual({ uiOptions: { showWalletUIs: false } });
  });
});

describe('signVoteWithWalletPrompt', () => {
  it('leaves the provider modal on (no ui options)', async () => {
    const { input, sendTransaction } = setup();
    await signVoteWithWalletPrompt(input());
    expect(sendTransaction).toHaveBeenCalledTimes(1);
    expect(sendTransaction.mock.calls[0][1]).toBeUndefined();
  });
});
