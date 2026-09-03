'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeftRight } from 'lucide-react';

import { InteractionBar } from '@hypha-platform/epics';
import { Button } from '@hypha-platform/ui';
import { setCookie, HYPHA_ASSISTANT_MODE } from '@hypha-platform/cookie';

import { ConnectedButtonProfile } from './connected-button-profile';

const COOKIE_MAX_AGE_DAYS = 365;

/**
 * Hypha wiring for the #2486 interaction bar. Mounted by `ConnectedMenuTop` in
 * place of the app navbar on `/[lang]/assistant` (spec §2.2). The generic
 * `InteractionBar` stays Hypha-agnostic; this passes the real slots:
 *
 * - mode toggle → switches to the classic (navigation) app and persists the
 *   choice in `HYPHA_ASSISTANT_MODE=classic` so the assistant-first redirect
 *   stops firing;
 * - trailing → the profile avatar.
 *
 * Milestone 1: static — the text input is not wired to the model yet, and the
 * history toggle is local-only (no persistence).
 */
export function ConnectedAssistantInteractionBar() {
  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const tNav = useTranslations('Navigation');
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const navItems = [
    { label: tNav('mySpaces'), href: `/${lang}/my-spaces` },
    { label: tNav('myWallet'), href: `/${lang}/my-wallet` },
    { label: tNav('network'), href: `/${lang}/network` },
  ];

  const switchToClassic = useCallback(() => {
    const expires = new Date(
      Date.now() + COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    );
    setCookie(HYPHA_ASSISTANT_MODE, 'classic', expires);
    router.push(`/${lang}/my-spaces`);
  }, [lang, router]);

  return (
    <InteractionBar
      historyExpanded={historyExpanded}
      onToggleHistory={() => setHistoryExpanded((v) => !v)}
      historyToggleLabel="Toggle conversation history"
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
          navItems={navItems}
          showNetworkFeedback
          compact
        />
      }
    />
  );
}
