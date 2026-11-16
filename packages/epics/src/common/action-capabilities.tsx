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
  /** Upvote on a signal. */
  | 'upvote'
  /** The pipeline (members only; needs a signed-in visitor). */
  | 'pipeline-data';

export type ActionStatus = 'live' | 'hidden' | 'full-app';

export type ActionCapabilitiesValue = {
  /** What an action the delivery cannot perform becomes (client setting). */
  unsupportedActions: 'hide' | 'full-app';
  /** Origin of the full app; empty when the page is already on it (iframe). */
  fullAppOrigin: string;
  /** True where a signed-in visitor can read the pipeline (a host with login). */
  pipelineData: boolean;
};

/** Kinds that never become a link to the full app: they are hidden. */
const ALWAYS_HIDDEN: readonly ActionKind[] = ['get-started', 'upvote'];

/** Pure: what one action is for a delivery. `null` value = the main app. */
export function resolveActionStatus(
  value: ActionCapabilitiesValue | null,
  kind: ActionKind,
): ActionStatus {
  if (!value) return 'live';
  if (kind === 'pipeline-data') return value.pipelineData ? 'live' : 'hidden';
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
  const { unsupportedActions, fullAppOrigin, pipelineData } = value;
  const memo = React.useMemo(
    () => ({ unsupportedActions, fullAppOrigin, pipelineData }),
    [unsupportedActions, fullAppOrigin, pipelineData],
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
        href={fullAppHref(fullAppPath)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    </Button>
  );
}
