import type { ReactNode } from 'react';
import { Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';

import { MemberPageShell } from '../../_components/member-page-shell';
import { MemberScreenTitle } from '../../_components/member-screen-title';

export async function MessagesPageFrame({
  children,
  heading = 'messages',
  spaceSlug,
}: {
  children: ReactNode;
  /** Suggestions uses its own title. The messages screen keeps "Share messages". */
  heading?: 'messages' | 'suggestions' | 'archived';
  /** Member messages stay inside this space. */
  spaceSlug?: string;
}) {
  const t = await getTranslations('Connections');
  const tMember = await getTranslations('MemberMenu');
  const spaceLabel = spaceSlug?.replace(/-/g, ' ');
  const titleLineTwo = spaceSlug
    ? tMember('spaceMessages', { space: spaceLabel ?? spaceSlug })
    : heading === 'suggestions'
    ? t('reachOut')
    : heading === 'archived'
    ? t('tabs.archived')
    : t('titleLineTwo');
  const memberTitle =
    heading === 'suggestions'
      ? t('tabs.suggestions')
      : heading === 'archived'
      ? t('tabs.archived')
      : t('tabs.messages');

  return (
    <div className="w-full min-w-0 overflow-x-clip">
      <MemberPageShell>
        <MemberScreenTitle screen="messages" memberTitle={memberTitle}>
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
        </MemberScreenTitle>
        <div>{children}</div>
      </MemberPageShell>
    </div>
  );
}
