import 'server-only';

import {
  getMemberIntelligence,
  resolveMemberCaller,
} from '@hypha-platform/core/server';

export async function loadMemberHomeFacts(authToken: string): Promise<{
  chatSpaceSlug: string | null;
  home: NonNullable<Awaited<ReturnType<typeof getMemberIntelligence>>>;
} | null> {
  const caller = await resolveMemberCaller(authToken);
  if (!caller?.person.id) return null;
  const home = await getMemberIntelligence(
    { personId: caller.person.id },
    { db: caller.db },
  );
  if (!home) return null;
  return {
    chatSpaceSlug: home.chatSpaceSlug,
    home,
  };
}
