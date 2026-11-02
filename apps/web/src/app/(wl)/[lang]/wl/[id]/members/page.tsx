import { MembersSection } from '@hypha-platform/epics';
import { useMembers } from '@web/hooks/use-members';
export default async function P({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  return (
    <MembersSection
      basePath={`/${lang}/wl/${id}/members/person`}
      useMembers={useMembers}
      spaceSlug={id}
      refreshInterval={5000}
    />
  );
}
