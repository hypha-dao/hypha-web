import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { TabScreenTitle } from '../_components/tab-screen-title';
import { WalletTabs } from '../_components/wallet-tabs';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function WalletPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;

  return (
    <SpaceTabAccessWrapper spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <TabScreenTitle title="My Wallet" />
        <WalletTabs lang={lang} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
