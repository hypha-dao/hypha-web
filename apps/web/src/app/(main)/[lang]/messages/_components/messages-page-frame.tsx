import type { ReactNode } from 'react';
import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';

export async function MessagesPageFrame({
  children,
  heading = 'messages',
}: {
  children: ReactNode;
  /** Suggestions uses its own title. The messages screen keeps "Share messages". */
  heading?: 'messages' | 'suggestions' | 'archived';
}) {
  const t = await getTranslations('Connections');
  const titleLineTwo =
    heading === 'suggestions'
      ? t('reachOut')
      : heading === 'archived'
      ? t('tabs.archived')
      : t('titleLineTwo');

  return (
    <div className="w-full min-w-0 overflow-x-clip">
      <Container
        className={
          // Match One Wallet: xl:gap-9 under the title. Page still scrolls;
          // the conversation list is capped separately so it scrolls too.
          'flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:gap-9 xl:pt-3 xl:pb-9'
        }
      >
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
        <div>{children}</div>
      </Container>
    </div>
  );
}
