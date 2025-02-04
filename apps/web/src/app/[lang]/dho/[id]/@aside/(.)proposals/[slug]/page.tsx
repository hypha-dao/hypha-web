'use client';
import { ProposalDetail } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useProposalBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { getDhoPathAgreements } from '../../../agreements/constants';
import { Locale } from '@hypha-platform/i18n';
export default function Agreements() {
  const { slug, id, lang } = useParams();
  const { data, isLoading } = useProposalBySlug(slug as string);

  return (
    <SidePanel>
      <ProposalDetail
        closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
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
    </SidePanel>
  );
}
