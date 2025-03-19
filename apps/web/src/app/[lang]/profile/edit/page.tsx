'use client';

import { EditPersonSection } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { useMe } from '@web/hooks/use-me';

export default function Loading() {
  const { lang } = useParams();
  const { person, isLoading } = useMe();

  return (
    <EditPersonSection
      avatar={person?.avatarUrl ?? ''}
      name={person?.name ?? ''}
      surname={person?.surname ?? ''}
      id={person?.id ?? null}
      nickname={person?.nickname ?? ''}
      description={person?.description ?? ''}
      leadImageUrl={person?.leadImageUrl ?? ''}
      closeUrl={`/${lang}/profile`}
      isLoading={isLoading}
    />
  );
}
