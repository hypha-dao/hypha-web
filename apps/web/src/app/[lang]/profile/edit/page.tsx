'use client';

import { EditPersonSection } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';

export default function Loading() {
  const { lang } = useParams();

  return (
    <EditPersonSection
      avatar="https://github.com/shadcn.png"
      name="Name"
      surname="Surname"
      id="ndb9suh3qh9q2hlP2120dsxzf"
      closeUrl={`/${lang}/person`}
      isLoading={false}
    />
  );
}
