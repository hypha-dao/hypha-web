'use client';

import { MemberDetail, useMemberBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { SidePanel } from '../../../_components/side-panel';
import { useSpaces } from 'packages/epics/src/membership/hooks/use-spaces';
import { Paths } from '@hypha-platform/tools';
import { Locale } from '@hypha-platform/i18n';

export default function Member() {
  const { slug, id, lang } = useParams();
  const { data, isLoading } = useMemberBySlug(slug as string);
  const { spaces } = useSpaces({
    page: 1,
    sort: { sort: 'all' },
  });

  return (
    <SidePanel>
      <MemberDetail
        closeUrl={Paths.dho.membership(lang as Locale, id as string)}
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
        basePath={Paths.dho.agreements(lang as Locale, id as string)}
        spaces={spaces}
      />
    </SidePanel>
  );
}
