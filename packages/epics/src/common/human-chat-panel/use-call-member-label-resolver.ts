'use client';

import { useCallback, useMemo } from 'react';
import type { Person } from '@hypha-platform/core/client';
import {
  useMatrix,
  useMatrixUserIdsByPrivySubs,
  useMe,
} from '@hypha-platform/core/client';
import type { UseMembers } from '../../spaces';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
  matrixUserIdToCanonicalPrivySub,
  pickUserVisibleMemberLabel,
} from './matrix-room-member-display';

function personRosterLabel(p: Person, unknownLabel: string): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (p.nickname?.trim()) return p.nickname.trim();
  return unknownLabel;
}

type UseCallMemberLabelResolverParams = {
  roomId: string | null | undefined;
  spaceSlug: string | null | undefined;
  unknownMemberLabel: string;
  useMembers?: UseMembers;
};

/**
 * Hypha roster + Matrix member labels for call tiles (dock, PiP, placeholders).
 * Matches {@link HumanRightPanel} `resolveMemberLabel` so mobile dock does not show Privy slugs.
 */
export function useCallMemberLabelResolver({
  roomId,
  spaceSlug,
  unknownMemberLabel,
  useMembers,
}: UseCallMemberLabelResolverParams): (userId: string | undefined) => string {
  const { client } = useMatrix();
  const { person: me } = useMe();
  const currentUserId = client?.getUserId?.() ?? null;

  const { persons: spaceMembersResult } = useMembers?.({
    spaceSlug: spaceSlug ?? undefined,
    paginationDisabled: true,
  }) ?? { persons: undefined };
  const spaceMembers = useMemo(
    () => spaceMembersResult?.data ?? [],
    [spaceMembersResult?.data],
  );

  const rosterSubs = useMemo(
    () =>
      spaceMembers
        .map((p) => p.sub?.trim())
        .filter((s): s is string => Boolean(s)),
    [spaceMembers],
  );

  const { subToMatrixUserId } = useMatrixUserIdsByPrivySubs({
    privySubs: rosterSubs,
  });

  const matrixUserIdToPersonLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of spaceMembers) {
      const sub = p.sub?.trim();
      if (!sub) continue;
      const mxid = subToMatrixUserId[sub]?.trim();
      if (!mxid) continue;
      m.set(mxid, personRosterLabel(p, unknownMemberLabel));
    }
    return m;
  }, [spaceMembers, subToMatrixUserId, unknownMemberLabel]);

  const personLabelByPrivySub = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of spaceMembers) {
      const sub = p.sub?.trim();
      if (!sub) continue;
      m.set(sub, personRosterLabel(p, unknownMemberLabel));
    }
    return m;
  }, [spaceMembers, unknownMemberLabel]);

  return useCallback(
    (userId: string | undefined) => {
      if (!userId) return unknownMemberLabel;
      if (currentUserId && userId === currentUserId) {
        const full = [me?.name, me?.surname].filter(Boolean).join(' ').trim();
        return full || unknownMemberLabel;
      }
      const rosterLabel = matrixUserIdToPersonLabel.get(userId)?.trim();
      if (rosterLabel) return rosterLabel;
      const localpartSub = matrixUserIdToCanonicalPrivySub(userId);
      if (localpartSub) {
        const rosterBySub = personLabelByPrivySub.get(localpartSub)?.trim();
        if (rosterBySub) return rosterBySub;
      }
      if (roomId && client) {
        const member = client.getRoom(roomId)?.getMember(userId);
        if (member) {
          const fromMatrix = matrixMemberDisplayLabel(member, userId);
          if (!looksLikeTechnicalMatrixDisplayName(fromMatrix, userId)) {
            return fromMatrix;
          }
        }
      }
      return pickUserVisibleMemberLabel(userId) ?? '';
    },
    [
      client,
      currentUserId,
      matrixUserIdToPersonLabel,
      me?.name,
      me?.surname,
      personLabelByPrivySub,
      roomId,
      unknownMemberLabel,
    ],
  );
}
