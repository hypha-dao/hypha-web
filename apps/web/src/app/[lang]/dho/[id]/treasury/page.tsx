import { Locale } from '@hypha-platform/i18n';
import {
  AssetsSection,
  PayoutsSection,
  RequestsSection,
} from '@hypha-platform/epics';
import { NavigationTabs } from '../_components/navigation-tabs';
import { Paths } from 'apps/web/src/app/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = Paths.dho.treasury(lang as Locale, id as string);

  return (
    <div>
      <NavigationTabs lang={lang} id={id} activeTab="treasury" />
      <AssetsSection basePath={`${basePath}/token`} />
      <RequestsSection />
      <PayoutsSection />
    </div>
  );
}
