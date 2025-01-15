'use client';

import { MemberDetail, useMemberBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { SidePanel } from '../../../_components/side-panel';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Member(props: PageProps) {
  const { slug, id, lang } = useParams();
  const { data, isLoading } = useMemberBySlug(slug as string);

  return (
    <SidePanel>
      <MemberDetail
        member={{
          avatar: data?.avatar,
          name: data?.name,
          surname: data?.surname,
          nickname: data?.nickname,
          commitment: data?.commitment,
          status: data?.status,
          about: data?.about,
          spaces: data?.spaces,
          agreements: data?.agreements,
        }}
        closeUrl={`/${lang}/dho/${id}/membership`}
        agreements={data?.agreements ?? []}
        isLoading={isLoading}
      />
    </SidePanel>
  );
}
