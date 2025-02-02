'use client';

import { MemberDetail, useMemberBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { useSpaces } from 'packages/epics/src/membership/hooks/use-spaces';

export default function Member() {
  const { slug, id, lang } = useParams();
  const { data, isLoading } = useMemberBySlug(slug as string);
  const { spaces } = useSpaces({
    page: 1,
    sort: { sort: 'all' },
  });

  return (
    <MemberDetail
      closeUrl={`/${lang}/dho/${id}/membership`}
      member={{
        avatar: data?.avatar,
        name: data?.name,
        surname: data?.surname,
        nickname: data?.nickname,
        commitment: data?.commitment,
        status: data?.status,
        about: data?.about,
      }}
      isLoading={isLoading}
      basePath={`/${lang}/dho/${id}/agreements`}
      spaces={spaces}
    />
  );
}
