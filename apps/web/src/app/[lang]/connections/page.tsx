import { MyConnections } from '@hypha-platform/epics';
import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';

export default async function ConnectionsPage() {
  const t = await getTranslations('Connections');

  return (
    <div className="w-full min-w-0 overflow-x-hidden overflow-y-auto">
      <Container className="flex min-w-0 flex-col gap-9 py-9">
        <Heading
          size="9"
          color="secondary"
          weight="medium"
          align="center"
          className="flex flex-col"
        >
          <span>{t('titleLineOne')}</span>
          <span>{t('titleLineTwo')}</span>
        </Heading>
        <MyConnections />
      </Container>
    </div>
  );
}
