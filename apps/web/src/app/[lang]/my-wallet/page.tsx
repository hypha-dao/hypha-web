import { Locale } from '@hypha-platform/i18n';
import { Container } from '@hypha-platform/ui';
import { MyWalletTabs } from '@web/components/my-wallet-tabs';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function MyWalletPage(props: PageProps) {
  const { lang } = await props.params;

  return (
    <Container className="flex w-full min-w-0 flex-col gap-4 py-4 sm:gap-5 sm:py-5">
      <h1 className="text-5 font-semibold tracking-tight text-foreground sm:text-7">
        My Wallet
      </h1>
      <MyWalletTabs lang={lang} />
    </Container>
  );
}
