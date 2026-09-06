'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { AssistantShell, readRecentSpaceSlugs } from '@hypha-platform/epics';
import type { GreetingContext } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe, useFindCoherences } from '@hypha-platform/core/client';

import { ConnectedButtonProfile } from '@web/components/connected-button-profile';
import { AssistantModeToggle } from '@web/components/assistant-mode-toggle';
import { hyphaAssistantConfig } from './config';
import { computeGuidanceAction } from './guidance';
import { useScopeCandidates } from './use-scope-candidates';

export function AssistantPageClient() {
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const { getAccessToken } = useAuthentication();
  const { person } = useMe();
  const [recentSpaceSlugs] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readRecentSpaceSlugs(),
  );

  // M7 — scope selector candidates + the model's name↔slug hint: the person's
  // on-chain memberships (with titles) first, recently-visited slugs as a
  // fallback. Recents alone would be empty in the talk-first UX.
  const { candidates: scopeCandidates } = useScopeCandidates({
    personAddress: person?.address,
    recentSpaceSlugs,
  });

  // Seed = most recent classic-app space, else the first membership space.
  const primarySpaceSlug = recentSpaceSlugs[0] ?? scopeCandidates[0]?.slug;

  // M7 — the conversation's active scope (seeded above, moved by the selector
  // or the model's `set_scope`). Reported up from `AssistantShell`.
  const [activeScopeSlug, setActiveScopeSlug] = useState<string | undefined>(
    primarySpaceSlug,
  );
  const guidanceSpaceSlug = activeScopeSlug ?? primarySpaceSlug;

  const greetingContext = useMemo<GreetingContext>(
    () => ({
      displayName: person?.name ?? undefined,
      primarySpaceSlug,
      recentSpaceSlugs,
    }),
    [person?.name, primarySpaceSlug, recentSpaceSlugs],
  );

  // D5 guidance beat — one nudge derived from the active space's signals.
  // `useFindCoherences` no-ops (null SWR key) when there is no slug.
  const { coherences } = useFindCoherences({ spaceSlug: guidanceSpaceSlug });
  const guidanceAction = useMemo(
    () =>
      computeGuidanceAction({
        spaceSlug: guidanceSpaceSlug,
        signals: coherences ?? [],
      }),
    [guidanceSpaceSlug, coherences],
  );

  const transport = useMemo(
    () => ({
      endpoint: '/api/chat',
      getAuthToken: async () => {
        try {
          return (await getAccessToken?.()) ?? undefined;
        } catch {
          return undefined;
        }
      },
    }),
    [getAccessToken],
  );

  return (
    <AssistantShell
      config={hyphaAssistantConfig}
      greetingContext={greetingContext}
      transport={transport}
      scopeCandidates={scopeCandidates}
      onActiveScopeChange={setActiveScopeSlug}
      guidanceAction={guidanceAction}
      modeToggleSlot={<AssistantModeToggle activeMode="assistant" />}
      trailingSlot={
        <ConnectedButtonProfile
          newUserRedirectPath="/profile/signup"
          baseRedirectPath="/assistant"
          navItems={[
            { label: 'My Spaces', href: `/${lang}/my-spaces` },
            { label: 'My Wallet', href: `/${lang}/my-wallet` },
            { label: 'Network', href: `/${lang}/network` },
          ]}
          showNetworkFeedback
          compact
        />
      }
    />
  );
}
