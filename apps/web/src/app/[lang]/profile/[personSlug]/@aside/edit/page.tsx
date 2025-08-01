'use client';

import { SidePanel, EditPersonSection } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import { useParams } from 'next/navigation';
import { useEditProfile } from '@web/hooks/use-edit-profile';

export default function EditProfilePage() {
  const { lang, personSlug } = useParams();
  const { person, isLoading, revalidate } = useMe();
  const { editProfile, isEditing, error } = useEditProfile();

  return (
    <SidePanel>
      <EditPersonSection
        person={person}
        closeUrl={`/${lang}/profile/${personSlug}`}
        isLoading={isLoading || isEditing}
        onEdit={editProfile}
        onUpdate={revalidate}
        error={error}
      />
    </SidePanel>
  );
}
