'use client';

import {
  RESUBMIT_PROPOSAL_DATA_KEY,
  getProposalTemplateSegmentFromPathname,
} from '../utils/resubmit-proposal-template';
import { isProposalCreateFormPath } from './proposal-form-navigation';
import { readActiveGovernanceProposalSession } from './governance-proposal-walkthrough-session';

export const ACTIVE_PROPOSAL_FORM_LIVE_KEY =
  'hypha:active-proposal-form-live:v1';

export type ActiveProposalFormSnapshotPayload = {
  templateSegment: string;
  formOpen: boolean;
  resubmitPayload?: Record<string, unknown>;
  liveFields?: Record<string, unknown>;
  activeGovernanceProposal?: {
    proposalType: string;
    collectedFields: Record<string, unknown>;
    formOpen?: boolean;
  };
  updatedAt: string;
};

export function writeActiveProposalFormLiveFields(
  templateSegment: string,
  liveFields: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !templateSegment) return;
  try {
    const prevRaw = sessionStorage.getItem(ACTIVE_PROPOSAL_FORM_LIVE_KEY);
    const prev = prevRaw
      ? (JSON.parse(prevRaw) as ActiveProposalFormSnapshotPayload)
      : null;
    const next: ActiveProposalFormSnapshotPayload = {
      templateSegment,
      formOpen: true,
      resubmitPayload: prev?.resubmitPayload,
      liveFields,
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(ACTIVE_PROPOSAL_FORM_LIVE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function readActiveProposalFormSnapshot(
  pathname: string | null | undefined,
): ActiveProposalFormSnapshotPayload | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!isProposalCreateFormPath(pathname)) return undefined;

  const templateSegment = getProposalTemplateSegmentFromPathname(pathname);
  if (templateSegment === null) return undefined;

  let resubmitPayload: Record<string, unknown> | undefined;
  try {
    const raw = sessionStorage.getItem(RESUBMIT_PROPOSAL_DATA_KEY);
    if (raw) {
      resubmitPayload = JSON.parse(raw) as Record<string, unknown>;
    }
  } catch {
    resubmitPayload = undefined;
  }

  let liveFields: Record<string, unknown> | undefined;
  try {
    const liveRaw = sessionStorage.getItem(ACTIVE_PROPOSAL_FORM_LIVE_KEY);
    if (liveRaw) {
      const live = JSON.parse(liveRaw) as ActiveProposalFormSnapshotPayload;
      if (live.templateSegment === templateSegment) {
        liveFields = live.liveFields;
      }
    }
  } catch {
    liveFields = undefined;
  }

  return {
    templateSegment,
    formOpen: true,
    resubmitPayload,
    liveFields: liveFields ?? {},
    activeGovernanceProposal: (() => {
      const session = readActiveGovernanceProposalSession();
      if (!session) return undefined;
      return {
        proposalType: session.proposalType,
        collectedFields: session.collectedFields,
        formOpen: session.formOpen ?? true,
      };
    })(),
    updatedAt: new Date().toISOString(),
  };
}
