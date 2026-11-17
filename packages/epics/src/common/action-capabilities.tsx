'use client';

import * as React from 'react';
import { Button } from '@hypha-platform/ui';

/**
 * Actions a delivery may not be able to perform. The main app mounts no
 * provider, so every action is live there. A white-label tree mounts
 * `ActionCapabilitiesProvider`; the shared components then render nothing, or a
 * link to the same Space in the full app, for what that delivery cannot do.
 *
 * This only ADDS to `canLogin` (authentication): `canLogin` still hides what a
 * tree without login cannot do; this also covers a host that does have login
 * but not (yet) these writes.
 */
export type ActionKind =
  /** New proposal / memory / signal / token, update vault, add Space. */
  | 'create-flow'
  /** Claim rewards. */
  | 'claim'
  /** Join a Space. */
  | 'join'
  /** Invite, exit, delegate, undelegate. */
  | 'member-action'
  /** Deposit funds (opens the wallet funding flow). */
  | 'wallet-action'
  /** New or edit calendar item. */
  | 'calendar-write'
  /** Bank transfer, onboarding, KYC, payout accounts. */
  | 'banking-write'
  /** The separate "Get started" button next to "Sign in". */
  | 'get-started'
  /** Upvote on a signal (needs a signed-in member; Server Actions). */
  | 'upvote'
  /** Vote on a proposal, expire it and withdraw it (smart-wallet transactions). */
  | 'vote'
  /** New signal (a host with login that lists `signal`). */
  | 'create-signal'
  /** Create a Collective agreement (a host with login that lists `agreement`). */
  | 'create-agreement'
  /** Propose a contribution (a host with login that lists `contribution`). */
  | 'create-contribution'
  /** New proposal entry and its menu: live when any proposal type is. */
  | 'create-proposal'
  /** Opening a pipeline deal (a link to the deal page of the full app). */
  | 'deal-link'
  /** The pipeline (members only; needs a signed-in visitor). */
  | 'pipeline-data';

/**
 * Marks an anchor as an explicit exit to the full app. The white-label link
 * guard leaves it to the browser (new tab); otherwise, in the iframe, the
 * relative full-app URL of a served section would be mapped back into the frame.
 */
export const FULL_APP_EXIT_ATTR = 'data-wl-full-app-exit';

export type ActionStatus = 'live' | 'hidden' | 'full-app';

export type ActionCapabilitiesValue = {
  /** What an action the delivery cannot perform becomes (client setting). */
  unsupportedActions: 'hide' | 'full-app';
  /** Origin of the full app; empty when the page is already on it (iframe). */
  fullAppOrigin: string;
  /** True where a signed-in visitor can read the pipeline (a host with login). */
  pipelineData: boolean;
  /** True where a signed-in member can vote (a host with login). */
  voteLive: boolean;
  /**
   * Create flows on offer (`signal`, `agreement`, `contribution`); set only on a
   * host with login. Absent or empty: none are live, they stay hidden (or a
   * full-app link) as before.
   */
  createActions?: readonly string[];
};

/** Create kinds and the `createActions` values that make each live. */
const CREATE_KIND_VALUES: Partial<Record<ActionKind, readonly string[]>> = {
  'create-signal': ['signal'],
  'create-agreement': ['agreement'],
  'create-contribution': ['contribution'],
  'create-proposal': ['agreement', 'contribution'],
};

/** Kinds that never become a link to the full app: they are hidden. */
const ALWAYS_HIDDEN: readonly ActionKind[] = ['get-started'];

/** Pure: what one action is for a delivery. `null` value = the main app. */
export function resolveActionStatus(
  value: ActionCapabilitiesValue | null,
  kind: ActionKind,
): ActionStatus {
  if (!value) return 'live';
  if (kind === 'pipeline-data') return value.pipelineData ? 'live' : 'hidden';
  // Voting is live or hidden; never a link (there is no deep URL for it).
  if (kind === 'vote' || kind === 'upvote') {
    return value.voteLive ? 'live' : 'hidden';
  }
  const createValues = CREATE_KIND_VALUES[kind];
  if (createValues?.some((v) => value.createActions?.includes(v))) {
    return 'live';
  }
  if (ALWAYS_HIDDEN.includes(kind)) return 'hidden';
  return value.unsupportedActions === 'full-app' ? 'full-app' : 'hidden';
}

const ActionCapabilitiesContext =
  React.createContext<ActionCapabilitiesValue | null>(null);

/** Mounted once by a white-label root layout. The main app never mounts it. */
export function ActionCapabilitiesProvider({
  value,
  children,
}: {
  value: ActionCapabilitiesValue;
  children: React.ReactNode;
}) {
  const { unsupportedActions, fullAppOrigin, pipelineData, voteLive } = value;
  const createKey = (value.createActions ?? []).join(',');
  const memo = React.useMemo(
    () => ({
      unsupportedActions,
      fullAppOrigin,
      pipelineData,
      voteLive,
      createActions: createKey ? createKey.split(',') : [],
    }),
    [unsupportedActions, fullAppOrigin, pipelineData, voteLive, createKey],
  );
  return (
    <ActionCapabilitiesContext.Provider value={memo}>
      {children}
    </ActionCapabilitiesContext.Provider>
  );
}

/** `live` without a provider (main app). */
export function useActionStatus(kind: ActionKind): ActionStatus {
  const value = React.useContext(ActionCapabilitiesContext);
  return resolveActionStatus(value, kind);
}

/**
 * True only inside a white-label tree that can vote (provider mounted, host
 * with login). Without a provider it is false: `readOnly` stays display-only
 * wherever no capability says otherwise.
 */
export function useVoteEnabled(): boolean {
  return React.useContext(ActionCapabilitiesContext)?.voteLive === true;
}

/** Full-app URL of a main-app path (`/<lang>/dho/<slug>/...`). */
export function useFullAppHref(): (mainAppPath: string) => string {
  const value = React.useContext(ActionCapabilitiesContext);
  return React.useCallback(
    (mainAppPath: string) => `${value?.fullAppOrigin ?? ''}${mainAppPath}`,
    [value?.fullAppOrigin],
  );
}

/**
 * Renders `children` (the live control) where the action is live; nothing
 * where it is hidden; and, with `unsupportedActions: 'full-app'`, a link to
 * `fullAppPath` in the full app (new tab) labelled `label`.
 */
export function ActionGate({
  kind,
  fullAppPath,
  label,
  className,
  children,
}: {
  kind: ActionKind;
  fullAppPath: string;
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const status = useActionStatus(kind);
  const fullAppHref = useFullAppHref();
  if (status === 'live') return <>{children}</>;
  if (status === 'hidden') return null;
  return (
    <Button
      asChild
      variant="outline"
      colorVariant="accent"
      className={className}
    >
      <a
        {...{ [FULL_APP_EXIT_ATTR]: '' }}
        href={fullAppHref(fullAppPath)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    </Button>
  );
}
