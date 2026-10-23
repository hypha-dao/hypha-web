/**
 * Proof that the user explicitly agreed to one specific operation on a Hypha
 * screen. Signing without the wallet provider's own confirmation is only
 * allowed when the caller can show one of these (see `vote-signing.ts`).
 *
 * Create it ONLY from the click handler of the confirmation control the user
 * pressed, never earlier, never cached, never "to make a call type-check".
 *
 * A type brand cannot stop a determined caller. The runtime registry below
 * makes a forged object literal fail too, and `vote-signing.guard.test.ts`
 * makes any other use of the modal-hiding option visible in CI.
 */

declare const consentBrand: unique symbol;

export type ConsentSource = 'integration-approval';
export type ConsentOperation = 'vote';

export type UserExplicitConsent = Readonly<{
  source: ConsentSource;
  operation: ConsentOperation;
  /** Proposal id the user agreed to vote on. */
  subject: number;
  /** The choice the user agreed to (`true` = support). */
  support: boolean;
  /** Milliseconds since epoch, taken when the consent was recorded. */
  recordedAt: number;
  /** Integration action id, when the consent belongs to one. */
  actionId?: string;
}> & { readonly [consentBrand]: true };

/** Objects returned by `recordUserExplicitConsent`; nothing else is accepted. */
const recorded = new WeakSet<object>();

export const recordUserExplicitConsent = (input: {
  source: ConsentSource;
  operation: ConsentOperation;
  subject: number;
  support: boolean;
  actionId?: string;
  /** The instant of the user's gesture, when it is not "now" (tests too). */
  now?: number;
}): UserExplicitConsent => {
  const consent = Object.freeze({
    source: input.source,
    operation: input.operation,
    subject: input.subject,
    support: input.support,
    recordedAt: input.now ?? Date.now(),
    ...(input.actionId === undefined ? {} : { actionId: input.actionId }),
  }) as unknown as UserExplicitConsent;
  recorded.add(consent);
  return consent;
};

export const isRecordedUserExplicitConsent = (
  value: unknown,
): value is UserExplicitConsent =>
  typeof value === 'object' && value !== null && recorded.has(value);
