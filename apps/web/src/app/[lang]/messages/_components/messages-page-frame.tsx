import type { ReactNode } from 'react';
import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';

export async function MessagesPageFrame({
  children,
  heading = 'messages',
}: {
  children: ReactNode;
  /** Suggestions uses its own title. The messages screen keeps "Share messages". */
  heading?: 'messages' | 'suggestions';
}) {
  const t = await getTranslations('Connections');
  const titleLineTwo =
    heading === 'suggestions' ? t('reachOut') : t('titleLineTwo');

  return (
    <div className="w-full min-w-0 overflow-x-hidden overflow-y-auto">
      <Container className="flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:gap-9 xl:pt-3 xl:pb-9">
        <header className="xl:hidden">
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
          className="hidden flex-col xl:flex"
        >
          <span>{t('titleLineOne')}</span>
          <span>{titleLineTwo}</span>
        </Heading>
        {children}
      </Container>
    </div>
  );
}
