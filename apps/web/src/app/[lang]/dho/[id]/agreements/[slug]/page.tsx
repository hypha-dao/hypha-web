'use client';

import { AgreementDetail, useAgreementBySlug } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Paths } from 'apps/web/src/app/constants';
import { useParams } from 'next/navigation';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Agreements(props: PageProps) {
  const { slug, id, lang } = useParams();
  const { data, isLoading } = useAgreementBySlug(slug as string);

  return (
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
  );
}
