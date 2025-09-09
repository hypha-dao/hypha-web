import { Locale } from '@hypha-platform/i18n';
import { MembersSection } from '@hypha-platform/epics';

import { useMembers } from '@web/hooks/use-members';

import { getDhoPathMembers } from './constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const basePath = getDhoPathMembers(lang as Locale, id as string);

  return (
    <div className="flex flex-col gap-6 py-4">
      <MembersSection
        basePath={`${basePath}/person`}
        useMembers={useMembers}
        spaceSlug={id}
        refreshInterval={2000}
      />
    </div>
  );
}
