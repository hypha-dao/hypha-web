'use client';
import { AgreementDetail } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useAgreementBySlug } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Paths } from 'apps/web/src/app/constants';
import { Locale } from '@hypha-platform/i18n';

export default function Agreements() {
  const { slug, id, lang } = useParams();
  const { data, isLoading } = useAgreementBySlug(slug as string);

  return (
    <SidePanel>
      <AgreementDetail
        closeUrl={Paths.dho.agreements(lang as Locale, id as string)}
        onSetActiveFilter={() => console.log('set active filter')}
        content={data?.content || ''}
        creator={data?.creator}
        title={data?.title}
        commitment={data?.commitment}
        status={data?.status}
        isLoading={isLoading}
        comments={data?.comments}
      />
    </SidePanel>
  );
}
