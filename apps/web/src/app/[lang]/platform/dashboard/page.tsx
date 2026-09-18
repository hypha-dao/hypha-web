import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';
import { PayingSpacesDashboard } from '@web/components/paying-spaces-dashboard';

export default async function PlatformDashboardPage() {
  const t = await getTranslations('TokenHoldingsDashboard.payingSpaces');

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
          <span>{t('pageTitle')}</span>
          <span className="text-4 font-normal text-muted-foreground">
            {t('pageSubtitle')}
          </span>
        </Heading>
        <PayingSpacesDashboard spaceSlug="hypha" />
      </Container>
    </div>
  );
}
