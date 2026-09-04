'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';

import { AssistantShell, readRecentSpaceSlugs } from '@hypha-platform/epics';
import type { GreetingContext } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe, useFindCoherences } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { setCookie, HYPHA_ASSISTANT_MODE } from '@hypha-platform/cookie';

import { ConnectedButtonProfile } from '@web/components/connected-button-profile';
import { hyphaAssistantConfig } from './config';
import { computeGuidanceAction } from './guidance';

const COOKIE_MAX_AGE_DAYS = 365;

export function AssistantPageClient() {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const { getAccessToken } = useAuthentication();
  const { person } = useMe();
  const [recentSpaceSlugs] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readRecentSpaceSlugs(),
  );
  const primarySpaceSlug = recentSpaceSlugs[0];

  const greetingContext = useMemo<GreetingContext>(
    () => ({
      displayName: person?.name ?? undefined,
      primarySpaceSlug,
      recentSpaceSlugs,
    }),
    [person?.name, primarySpaceSlug, recentSpaceSlugs],
  );

  // D5 guidance beat — one nudge derived from the primary space's signals.
  // `useFindCoherences` no-ops (null SWR key) when there is no slug.
  const { coherences } = useFindCoherences({ spaceSlug: primarySpaceSlug });
  const guidanceAction = useMemo(
    () =>
      computeGuidanceAction({
        spaceSlug: primarySpaceSlug,
        signals: coherences ?? [],
      }),
    [primarySpaceSlug, coherences],
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

  const switchToClassic = useCallback(() => {
    setCookie(
      HYPHA_ASSISTANT_MODE,
      'classic',
      new Date(Date.now() + COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
    );
    router.push(`/${lang}/my-spaces`);
  }, [lang, router]);

  return (
    <AssistantShell
      config={hyphaAssistantConfig}
      greetingContext={greetingContext}
      transport={transport}
      guidanceAction={guidanceAction}
      modeToggleSlot={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={switchToClassic}
          title="Switch to the classic app"
        >
          <ArrowLeftRight className="size-4" />
          <span className="hidden sm:inline">Classic view</span>
        </Button>
      }
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
