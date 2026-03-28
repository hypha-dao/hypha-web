'use client';

import React from 'react';
import { UseFormReturn, FieldValues } from 'react-hook-form';

export const TOKEN_BACKING_VAULT_DRAFT_KEY = 'tokenBackingVaultProposalDraft';
/** Set when defaults were applied for a token (no on-chain vault); avoids wiping drafts on remount. */
export const TOKEN_BACKING_VAULT_PREFILL_TOKEN_KEY =
  'tokenBackingVaultLastPrefilledToken';

type DraftEnvelope<T extends FieldValues> = {
  spaceId: number;
  values: T;
};

function parseRedemptionDate(raw: unknown): Date | null | undefined {
  if (raw === null || raw === undefined) return raw as null | undefined;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function clearTokenBackingVaultFormDraft(spaceId: number) {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(TOKEN_BACKING_VAULT_DRAFT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DraftEnvelope<FieldValues>;
    if (parsed.spaceId === spaceId) {
      sessionStorage.removeItem(TOKEN_BACKING_VAULT_DRAFT_KEY);
      sessionStorage.removeItem(TOKEN_BACKING_VAULT_PREFILL_TOKEN_KEY);
    }
  } catch {
    sessionStorage.removeItem(TOKEN_BACKING_VAULT_DRAFT_KEY);
    sessionStorage.removeItem(TOKEN_BACKING_VAULT_PREFILL_TOKEN_KEY);
  }
}

/**
 * Persists token backing vault proposal form state in sessionStorage so navigating
 * away and back restores title, plugin fields, and attachments metadata.
 */
export function useTokenBackingVaultFormDraft<
  T extends FieldValues & {
    tokenBackingVault?: {
      redemptionStartDate?: Date | string | null;
    };
  },
>(form: UseFormReturn<T>, spaceId: number | null | undefined) {
  const restoredRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || spaceId == null) {
      restoredRef.current = true;
      return;
    }

    try {
      const raw = sessionStorage.getItem(TOKEN_BACKING_VAULT_DRAFT_KEY);
      if (!raw) {
        restoredRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as DraftEnvelope<T>;
      if (parsed.spaceId !== spaceId || !parsed.values) {
        restoredRef.current = true;
        return;
      }

      const v = { ...parsed.values } as T;
      const tbv = v.tokenBackingVault as T['tokenBackingVault'] | undefined;
      if (tbv && typeof tbv === 'object') {
        (v as Record<string, unknown>).tokenBackingVault = {
          ...tbv,
          redemptionStartDate: parseRedemptionDate(
            (tbv as { redemptionStartDate?: unknown }).redemptionStartDate,
          ),
        };
      }

      form.reset(v, { keepDefaultValues: false });
    } catch {
      sessionStorage.removeItem(TOKEN_BACKING_VAULT_DRAFT_KEY);
    } finally {
      restoredRef.current = true;
    }
  }, [form, spaceId]);

  const watched = form.watch();

  React.useEffect(() => {
    if (!restoredRef.current || spaceId == null) return;
    if (typeof window === 'undefined') return;
    if (!form.formState.isDirty) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const current = form.getValues();
        const tbv = current.tokenBackingVault as
          | {
              redemptionStartDate?: Date | null;
            }
          | undefined;
        const serialized: T = {
          ...current,
          tokenBackingVault: tbv
            ? {
                ...tbv,
                redemptionStartDate:
                  tbv.redemptionStartDate instanceof Date
                    ? tbv.redemptionStartDate.toISOString()
                    : tbv.redemptionStartDate,
              }
            : current.tokenBackingVault,
        } as T;

        sessionStorage.setItem(
          TOKEN_BACKING_VAULT_DRAFT_KEY,
          JSON.stringify({
            spaceId,
            values: serialized,
          } satisfies DraftEnvelope<T>),
        );
      } catch {
        /* ignore quota / serialization errors */
      }
    }, 400);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [watched, form, spaceId]);
}
