import { Locale } from '@hypha-platform/i18n';
import {
  AssetsSection,
  PayoutsSection,
  RequestsSection,
} from '@hypha-platform/epics';
import { getDhoPathTreasury } from './constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function TreasuryPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = getDhoPathTreasury(lang as Locale, id as string);

  return (
    <div className="flex flex-col gap-6 py-4">
      <AssetsSection basePath={`${basePath}/token`} />
      <RequestsSection />
      <PayoutsSection />
    </div>
  );
}
