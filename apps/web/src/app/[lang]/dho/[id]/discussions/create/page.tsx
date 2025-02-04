'use client';

import { CreateForm } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Paths } from 'apps/web/src/app/constants';
import { useParams } from 'next/navigation';

export default function Discussion() {
  const { id, lang } = useParams();

  return (
    <CreateForm
      isLoading={false}
      creator={{
        avatar: 'https://github.com/shadcn.png',
        name: 'Name',
        surname: 'Surname',
      }}
      closeUrl={Paths.dho.agreements(lang as Locale, id as string)}
      type="Discussion"
    />
  );
}
