import { Locale } from '@hypha-platform/i18n';
import {
  OuterSpacesSection,
  InnerSpacesSection,
  MembersSection,
} from '@hypha-platform/epics';
import { NavigationTabs } from '../_components/navigation-tabs';
import { Paths } from 'apps/web/src/app/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = Paths.dho.membership(lang as Locale, id as string);

  return (
    <div>
      <NavigationTabs lang={lang} id={id} activeTab="membership" />
      <OuterSpacesSection />
      <InnerSpacesSection basePath={`${basePath}/space`} />
      <MembersSection basePath={`${basePath}/person`} />
    </div>
  );
}
