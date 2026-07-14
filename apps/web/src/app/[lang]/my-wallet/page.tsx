import { MyWalletDashboard } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Container, Heading } from '@hypha-platform/ui';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function MyWalletPage(props: PageProps) {
  const { lang } = await props.params;
  const t = await getTranslations('MyWallet');

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
          <span>{t('allYourRewards')}</span>
          <span>{t('oneWallet')}</span>
        </Heading>
        <MyWalletDashboard lang={lang} />
      </Container>
    </div>
  );
}
