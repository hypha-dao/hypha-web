'use client';

import { ProposalDetail, useProposalBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Proposal(props: PageProps) {
  const { slug, id, lang } = useParams();
  const { data, isLoading } = useProposalBySlug(slug as string);

  return (
    <ProposalDetail
      closeUrl={`/${lang}/dho/${id}/agreements`}
      onAccept={() => console.log('accept')}
      onReject={() => console.log('reject')}
      onSetActiveFilter={() => console.log('set active filter')}
      content={data?.content}
      creator={data?.creator}
      title={data?.title}
      commitment={data?.commitment}
      status={data?.status}
      isLoading={isLoading}
    />
  );
}
