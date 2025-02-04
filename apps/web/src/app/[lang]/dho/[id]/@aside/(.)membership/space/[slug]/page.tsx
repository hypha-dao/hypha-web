'use client';

import { SubspaceDetail, useSubspaceBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { SidePanel } from '../../../_components/side-panel';
import { Paths } from 'apps/web/src/app/constants';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Subspace(props: PageProps) {
  const { slug, id, lang } = useParams();
  const { data } = useSubspaceBySlug(slug as string);

  return (
    <SidePanel>
      <SubspaceDetail
        closeUrl={Paths.dho.membership(lang as Locale, id as string)}
        title={data?.title}
        image={data?.image}
        content={data?.description || ''}
        members={data?.members}
      />
    </SidePanel>
  );
}
