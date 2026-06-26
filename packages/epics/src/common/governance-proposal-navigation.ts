'use client';

import { RESUBMIT_PROPOSAL_DATA_KEY } from '../utils/resubmit-proposal-template';
import { stableJsonFingerprint } from './proposal-form-navigation';

export const RESUBMIT_PROPOSAL_UPDATED_EVENT =
  'hypha:resubmit-proposal-updated';

export const GOVERNANCE_PROPOSAL_PUBLISHED_EVENT =
  'hypha:governance-proposal-published';

const STALE_GOVERNANCE_PREPARE_NAV_KEYS = 'staleGovernancePrepareNavKeys';

export function markGovernancePrepareNavigationKeysStale(keys: string[]): void {
  if (typeof window === 'undefined' || keys.length === 0) return;
  try {
    const prevRaw = sessionStorage.getItem(STALE_GOVERNANCE_PREPARE_NAV_KEYS);
    const prev = prevRaw ? (JSON.parse(prevRaw) as string[]) : [];
    const merged = [...new Set([...prev, ...keys])];
    sessionStorage.setItem(
      STALE_GOVERNANCE_PREPARE_NAV_KEYS,
      JSON.stringify(merged),
    );
  } catch {
    sessionStorage.setItem(
      STALE_GOVERNANCE_PREPARE_NAV_KEYS,
      JSON.stringify(keys),
    );
  }
}

export function isGovernancePrepareNavigationStale(key: string): boolean {
  if (typeof window === 'undefined' || !key) return false;
  try {
    const raw = sessionStorage.getItem(STALE_GOVERNANCE_PREPARE_NAV_KEYS);
    if (!raw) return false;
    const stale = JSON.parse(raw) as string[];
    return stale.includes(key);
  } catch {
    return false;
  }
}

export function notifyGovernanceProposalPublished(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GOVERNANCE_PROPOSAL_PUBLISHED_EVENT));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merge resubmit payloads so successive AI updates do not drop earlier fields. */
export function mergeGovernanceResubmitPayloads(
  previous: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...previous, ...incoming };

  if (
    isPlainObject(previous.quorumAndUnity) ||
    isPlainObject(incoming.quorumAndUnity)
  ) {
    merged.quorumAndUnity = {
      ...(isPlainObject(previous.quorumAndUnity)
        ? previous.quorumAndUnity
        : {}),
      ...(isPlainObject(incoming.quorumAndUnity)
        ? incoming.quorumAndUnity
        : {}),
    };
  }

  if (Array.isArray(previous.members) || Array.isArray(incoming.members)) {
    merged.members = Array.isArray(incoming.members)
      ? incoming.members
      : previous.members;
  }

  for (const nestedKey of [
    'proposeContributionForm',
    'payForExpensesForm',
    'deployFundsForm',
    'issueNewTokenForm',
    'spaceTokenPurchaseForm',
    'buyHyphaTokensForm',
    'tokenBackingVault',
    'redeemResubmit',
    'mint',
    'tokenBurning',
  ] as const) {
    if (
      isPlainObject(previous[nestedKey]) ||
      isPlainObject(incoming[nestedKey])
    ) {
      merged[nestedKey] = {
        ...(isPlainObject(previous[nestedKey]) ? previous[nestedKey] : {}),
        ...(isPlainObject(incoming[nestedKey]) ? incoming[nestedKey] : {}),
      };
    }
  }

  if (incoming.title === undefined || incoming.title === '') {
    merged.title = previous.title;
  } else if (
    incoming.title === 'Governance proposal' &&
    typeof previous.title === 'string' &&
    previous.title.trim() !== '' &&
    previous.title !== 'Governance proposal'
  ) {
    merged.title = previous.title;
  }
  if (incoming.description === undefined || incoming.description === '') {
    merged.description = previous.description;
  } else if (
    incoming.description ===
      'Prepared with Hypha AI — review and edit on the form before publishing.' &&
    typeof previous.description === 'string' &&
    previous.description.trim() !== '' &&
    previous.description !==
      'Prepared with Hypha AI — review and edit on the form before publishing.'
  ) {
    merged.description = previous.description;
  }

  if (
    incoming.autoExecution === undefined &&
    previous.autoExecution !== undefined
  ) {
    merged.autoExecution = previous.autoExecution;
  }
  if (
    incoming.votingDuration === undefined &&
    previous.votingDuration !== undefined
  ) {
    merged.votingDuration = previous.votingDuration;
  }

  return merged;
}

export function writeGovernanceProposalResubmitPayload(
  payload: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  let merged = payload;
  try {
    const prevRaw = sessionStorage.getItem(RESUBMIT_PROPOSAL_DATA_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw) as Record<string, unknown>;
      merged = mergeGovernanceResubmitPayloads(prev, payload);
    }
  } catch {
    merged = payload;
  }

  const next = stableJsonFingerprint(merged);
  const prev = sessionStorage.getItem(RESUBMIT_PROPOSAL_DATA_KEY);
  if (prev === next) return;
  sessionStorage.setItem(RESUBMIT_PROPOSAL_DATA_KEY, next);
  window.dispatchEvent(new CustomEvent(RESUBMIT_PROPOSAL_UPDATED_EVENT));
}
