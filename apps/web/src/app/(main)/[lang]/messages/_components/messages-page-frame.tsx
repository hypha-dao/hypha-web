import type { ReactNode } from 'react';
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
          {/* Builder/funder only — MemberScreenTitle swaps this for members. */}
          <header className="craft-page-header shrink-0">
            <p className="mb-1 text-1 font-medium text-muted-foreground">
              {t('titleLineOne')}
            </p>
            <h1 className="craft-page-title m-0 text-6 font-medium">
              {titleLineTwo}
            </h1>
          </header>
        </MemberScreenTitle>
        <div>{children}</div>
      </MemberPageShell>
    </div>
  );
}
