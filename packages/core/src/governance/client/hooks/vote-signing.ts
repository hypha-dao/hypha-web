import { encodeFunctionData, type Hash } from 'viem';
import { daoProposalsImplementationConfig } from '@hypha-platform/core/generated';
import {
  isRecordedUserExplicitConsent,
  type UserExplicitConsent,
} from './user-explicit-consent';

/** How long a recorded consent stays usable for signing. */
export const CONSENT_MAX_AGE_MS = 60_000;

export const CONSENT_REQUIRED = 'Explicit user consent is required to vote';
export const CONSENT_MISMATCH = 'Consent does not match this vote';
export const CONSENT_STALE = 'Consent is too old; ask the user again';

type VoteSigner = {
  sendTransaction: (
    input: { to: `0x${string}`; data: `0x${string}`; value: bigint },
    options?: { uiOptions?: { showWalletUIs?: boolean } },
  ) => Promise<Hash>;
};

type VoteInput = {
  signer: VoteSigner;
  contractAddress: `0x${string}`;
  proposalId: number;
  support: boolean;
};

const sendVote = ({
  signer,
  contractAddress,
  proposalId,
  support,
  hideWalletUi,
}: VoteInput & { hideWalletUi: boolean }): Promise<Hash> =>
  signer.sendTransaction(
    {
      to: contractAddress,
      data: encodeFunctionData({
        abi: daoProposalsImplementationConfig.abi,
        functionName: 'vote',
        args: [BigInt(proposalId), support],
      }),
      value: 0n,
    },
    // This is the ONLY place the wallet provider's confirmation is turned
    // off. Do not add another one (the guard test fails if you do).
    hideWalletUi ? { uiOptions: { showWalletUIs: false } } : undefined,
  );

/** Default path: the wallet provider shows its own confirmation. */
export const signVoteWithWalletPrompt = (input: VoteInput): Promise<Hash> =>
  sendVote({ ...input, hideWalletUi: false });

/**
 * Signs a vote WITHOUT the wallet provider's confirmation.
 *
 * Only call this from a screen that has just asked the user, in Hypha's own
 * words, to confirm this exact vote, passing the consent recorded by that
 * click. A plain call (proposal page, member home) must keep using the
 * default path; do not "optimise" it into this one.
 */
export const signVoteWithExplicitConsent = (
  input: VoteInput,
  consent: UserExplicitConsent,
  now: number = Date.now(),
): Promise<Hash> => {
  if (!isRecordedUserExplicitConsent(consent)) {
    throw new Error(CONSENT_REQUIRED);
  }
  if (
    consent.operation !== 'vote' ||
    consent.subject !== input.proposalId ||
    consent.support !== input.support
  ) {
    throw new Error(CONSENT_MISMATCH);
  }
  const age = now - consent.recordedAt;
  if (age < 0 || age > CONSENT_MAX_AGE_MS) {
    throw new Error(CONSENT_STALE);
  }
  return sendVote({ ...input, hideWalletUi: true });
};
