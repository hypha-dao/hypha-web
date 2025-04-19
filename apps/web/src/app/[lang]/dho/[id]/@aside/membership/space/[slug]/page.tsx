'use client';

import { useParams } from 'next/navigation';
import { SubspaceDetail, useSubspaceBySlug } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

import { SidePanel } from '@web/app/[lang]/@aside/_components/side-panel';
import { getDhoPathMembership } from '@web/app/[lang]/dho/[id]/membership/constants';
import { useMembers } from '@web/hooks/use-members';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Subspace(props: PageProps) {
  const { slug, id, lang } = useParams();
  const { data } = useSubspaceBySlug(slug as string);

  return (
    <SidePanel>
      <SubspaceDetail
        closeUrl={getDhoPathMembership(lang as Locale, id as string)}
        title={data?.title}
        image={data?.image}
        content={data?.description || ''}
        memberBasePath={''}
        useMembers={useMembers}
      />
    </SidePanel>
  );
}
