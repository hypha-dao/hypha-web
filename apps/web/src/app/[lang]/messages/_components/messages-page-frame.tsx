import type { ReactNode } from 'react';
import { Container, Heading } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { getTranslations } from 'next-intl/server';

export async function MessagesPageFrame({
  children,
  heading = 'messages',
  fillViewport = false,
}: {
  children: ReactNode;
  /** Suggestions uses its own title. The messages screen keeps "Share messages". */
  heading?: 'messages' | 'suggestions' | 'archived';
  /** Title stays put. Only the conversation list scrolls inside its frame. */
  fillViewport?: boolean;
}) {
  const t = await getTranslations('Connections');
  const titleLineTwo =
    heading === 'suggestions'
      ? t('reachOut')
      : heading === 'archived'
      ? t('tabs.archived')
      : t('titleLineTwo');

  return (
    <div
      className={cn(
        'w-full min-w-0 overflow-x-clip',
        fillViewport && 'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
      )}
    >
      <Container
        className={cn(
          'flex min-w-0 flex-col gap-4 py-3 sm:py-4 lg:py-5 xl:gap-6 xl:pt-3 xl:pb-6',
          fillViewport && 'h-full min-h-0 flex-1',
        )}
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
        <div
          className={cn(
            fillViewport &&
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          )}
        >
          {children}
        </div>
      </Container>
    </div>
  );
}
