import 'server-only';

import {
  getMemberIntelligence,
  resolveMemberCaller,
} from '@hypha-platform/core/server';

import { formatMemberHomeFacts } from './member-home-facts';

export async function loadMemberHomeFacts(
  authToken: string,
): Promise<{ chatSpaceSlug: string | null; facts: string } | null> {
  const caller = await resolveMemberCaller(authToken);
  if (!caller?.person.id) return null;
  const home = await getMemberIntelligence(
    { personId: caller.person.id },
    { db: caller.db },
  );
  if (!home) return null;
  return {
    chatSpaceSlug: home.chatSpaceSlug,
    facts: formatMemberHomeFacts(home),
  };
}
