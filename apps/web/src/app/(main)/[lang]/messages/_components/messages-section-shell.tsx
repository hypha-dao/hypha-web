'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AccountRequiredGate, MyConnections } from '@hypha-platform/epics';
import { Container, Heading } from '@hypha-platform/ui';

import { MessagesViewportLock } from './messages-viewport-lock';

type MessagesSection = 'messages' | 'suggestions' | 'archived';

function messagesSectionFromPath(pathname: string | null): MessagesSection {
  if (!pathname) return 'messages';
  if (/\/(?:messages|connections)\/suggestions(?:\/|$)/.test(pathname)) {
    return 'suggestions';
  }
  if (/\/(?:messages|connections)\/archived(?:\/|$)/.test(pathname)) {
    return 'archived';
  }
  return 'messages';
}

/**
 * Shared host for Messages / Suggestions / Archived so App Router soft
 * navigations do not remount `MyConnections` (that remount was the 2–3s
 * skeleton flash on every sub-nav tap).
 */
export function MessagesSectionShell() {
  const pathname = usePathname();
  const section = useMemo(() => messagesSectionFromPath(pathname), [pathname]);
  const t = useTranslations('Connections');
  const titleLineTwo =
    section === 'suggestions'
      ? t('reachOut')
      : section === 'archived'
      ? t('tabs.archived')
      : t('titleLineTwo');

  return (
    <MessagesViewportLock>
      <div className="w-full min-w-0 overflow-x-clip">
        <Container className="flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:gap-9 xl:pt-3 xl:pb-9">
          <header className="shrink-0 xl:hidden">
            <p className="mb-2 text-1 font-bold uppercase text-foreground">
              {t('titleLineOne')}
            </p>
            <h1
              className="text-7 leading-tight sm:text-8"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {titleLineTwo}
            </h1>
          </header>
          <Heading
            size="9"
            color="secondary"
            weight="medium"
            align="center"
            className="hidden shrink-0 flex-col xl:flex"
          >
            <span>{t('titleLineOne')}</span>
            <span>{titleLineTwo}</span>
          </Heading>
          <div>
            <AccountRequiredGate>
              <MyConnections section={section} />
            </AccountRequiredGate>
          </div>
        </Container>
      </div>
    </MessagesViewportLock>
  );
}
