/**
 * How these tags are used (decided in #2470 / #2549, server-side since #2611):
 * - `subscribed` is the opt-in enrolment flag (master switch, account-level). Email and push both
 *   require it to be `'true'`; it does not require push permission, so email-only users can enrol.
 * - `push` / `email` are user-level channel switches; the device's own push permission and
 *   subscription stay in the browser SDK. Email also needs an enabled Email subscription.
 * - Preference tags (`consent_*`, `sub_*`) are enabled by default: absent = on, `'disabled'` = off.
 * - Settings are read and written server-side (`core/preferences.ts`) by `external_id` = person slug.
 */
export const TAG_SUBSCRIBED = 'subscribed';
export const TAG_PUSH = 'push';
export const TAG_EMAIL = 'email';
export const TAG_MENTION_CONSENT = 'consent_mentions';
export const TAG_MEETING_CONSENT = 'consent_meetings';

export const TAG_SUB_OWN_ACTIONS = 'sub_ownActions';
export const TAG_SUB_SIGNALS = 'sub_signals';
export const TAG_SUB_NEW_PROPOSAL_OPEN = 'sub_newProposalOpen';
export const TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED =
  'sub_proposalApprovedOrRejected';

/** Enrolment + global channel switches. */
export const MAIN_TAGS = [TAG_SUBSCRIBED, TAG_PUSH, TAG_EMAIL] as const;

/**
 * The six preference groups the Notification Centre exposes (#2549 D3) — each one toggle for both
 * channels. Enabled = tag absent / `'true'`; disabled = `'disabled'` / legacy `'false'` (D4).
 */
export const SUBSCRIPTION_TAGS = [
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
  TAG_MENTION_CONSENT,
  TAG_MEETING_CONSENT,
  TAG_SUB_SIGNALS,
  TAG_SUB_OWN_ACTIONS,
] as const;

/** Written when a user switches a type/channel off. Absence of the tag means enabled (#2549 D4). */
export const TAG_VALUE_DISABLED = 'disabled';

/** Disabled = the `'disabled'` marker or the legacy explicit `'false'` opt-out. Absent / `'true'` = enabled. */
export function isTagDisabled(value: string | undefined): boolean {
  return value === TAG_VALUE_DISABLED || value === 'false';
}

export const TAGS = [...MAIN_TAGS, ...SUBSCRIPTION_TAGS] as const;

export type Tag = (typeof TAGS)[number];
export type MainTag = (typeof MAIN_TAGS)[number];
export type SubscriptionTag = (typeof SUBSCRIPTION_TAGS)[number];
