import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { MyWalletTabs } from '@web/components/my-wallet-tabs';
import { getTranslations } from 'next-intl/server';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function MyWalletPage(props: PageProps) {
  const { lang } = await props.params;
  const tNav = await getTranslations('Navigation');

  return (
    <Container className="flex w-full flex-col gap-4 py-4">
      <h1 className="text-7 font-semibold tracking-tight text-foreground">
        {tNav('myWallet')}
      </h1>
      <MyWalletTabs lang={lang} />
    </Container>
  );
}
