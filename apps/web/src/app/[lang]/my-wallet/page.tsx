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
    <div className="w-full overflow-auto">
      <Container className="flex flex-col gap-6 py-9">
        <Heading size="9" color="secondary" weight="medium">
          {t('title')}
        </Heading>
        <MyWalletDashboard lang={lang} />
      </Container>
    </div>
  );
}
