'use client';

import { EditPersonSection } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams } from 'next/navigation';
import { useMe } from '@web/hooks/use-me';

export default function EditProfilePage() {
  const { lang } = useParams();
  const { person, isLoading } = useMe();

  return (
    <SidePanel>
      <EditPersonSection
        avatar={person?.avatarUrl ?? ''}
        name={person?.name ?? ''}
        surname={person?.surname ?? ''}
        id={person?.id ?? null}
        nickname={person?.nickname ?? ''}
        description={person?.description ?? ''}
        leadImageUrl={person?.leadImageUrl ?? ''}
        closeUrl={`/${lang}/person`}
        isLoading={isLoading}
      />
    </SidePanel>
  );
}
