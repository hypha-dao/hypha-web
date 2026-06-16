'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DISMISS_PREFIX = 'hypha-call-join-invite-dismissed-';

export function readJoinInviteDismissed(roomId: string | null): boolean {
  if (!roomId?.trim() || typeof window === 'undefined') return false;
  try {
    return (
      window.sessionStorage.getItem(`${DISMISS_PREFIX}${roomId.trim()}`) === '1'
    );
  } catch {
    return false;
  }
}

export function persistJoinInviteDismissed(roomId: string | null): void {
  if (!roomId?.trim() || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${DISMISS_PREFIX}${roomId.trim()}`, '1');
  } catch {
    /* ignore */
  }
}

export function clearJoinInviteDismissed(roomId: string | null): void {
  if (!roomId?.trim() || typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`${DISMISS_PREFIX}${roomId.trim()}`);
  } catch {
    /* ignore */
  }
}

export type UseCallJoinInvitationOptions = {
  roomId: string | null;
  showJoinOpportunity: boolean;
};

/** CSH-DISCOVER-1 / §1.2.2 — open once per join-opportunity episode per room. */
export function useCallJoinInvitation({
  roomId,
  showJoinOpportunity,
}: UseCallJoinInvitationOptions) {
  const [open, setOpen] = useState(false);
  const prevOpportunityRef = useRef(false);

  useEffect(() => {
    if (!showJoinOpportunity) {
      if (prevOpportunityRef.current && roomId?.trim()) {
        clearJoinInviteDismissed(roomId);
      }
      prevOpportunityRef.current = false;
      setOpen(false);
      return;
    }

    const rose = showJoinOpportunity && !prevOpportunityRef.current;
    prevOpportunityRef.current = true;
    if (!rose || !roomId?.trim()) return;
    if (readJoinInviteDismissed(roomId)) return;
    setOpen(true);
  }, [roomId, showJoinOpportunity]);

  const dismiss = useCallback(() => {
    persistJoinInviteDismissed(roomId);
    setOpen(false);
  }, [roomId]);

  return { open, dismiss, setOpen };
}
