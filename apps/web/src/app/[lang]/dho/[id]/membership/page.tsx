import { Locale } from '@hypha-platform/i18n';
import {
  OuterSpacesSection,
  InnerSpacesSection,
  MembersSection,
} from '@hypha-platform/epics';
import { NavigationTabs } from '../_components/navigation-tabs';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  return (
    <div>
      <NavigationTabs lang={lang} id={id} activeTab="membership" />
      <OuterSpacesSection />
      <InnerSpacesSection />
      <MembersSection />
    </div>
  );
}
