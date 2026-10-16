import { MyConnections } from '@hypha-platform/epics';
import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';

export default async function ConnectionsPage() {
  const t = await getTranslations('Connections');

  return (
    <div className="w-full min-w-0 overflow-x-hidden overflow-y-auto">
      <Container className="flex min-w-0 flex-col gap-9 py-9">
        <header className="xl:hidden">
          <p className="mb-2 text-1 font-bold uppercase text-foreground">
            {t('titleLineOne')}
          </p>
          <h1
            className="text-7 leading-tight sm:text-8"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('titleLineTwo')}
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
          <span>{t('titleLineTwo')}</span>
        </Heading>
        <MyConnections />
      </Container>
    </div>
  );
}
