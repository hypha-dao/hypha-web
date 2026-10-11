import { NetworkLoadingGrid } from '@hypha-platform/epics';
import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';

export default async function NetworkLoading() {
  const t = await getTranslations('Network');

  return (
    <Container className="flex flex-col gap-9 py-9">
      <p className="sr-only">{t('loading')}</p>
      <div className="flex min-w-0 flex-col gap-9">
        <Heading
          size="9"
          color="secondary"
          weight="medium"
          align="center"
          className="flex flex-col overflow-visible py-1"
          style={{ lineHeight: 1.15 }}
        >
          <span>{t('manySpaces')}</span>
          <span>{t('oneVibrantNetwork')}</span>
        </Heading>
        <div className="flex min-w-0 flex-col">
          <div className="mb-6 h-10 w-full animate-pulse rounded-md border border-neutral-4 bg-neutral-2" />
          <NetworkLoadingGrid
            count={12}
            cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          />
        </div>
      </div>
    </Container>
  );
}
