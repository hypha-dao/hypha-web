'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { Progress } from '@hypha-platform/ui';
import { useSpaceCreate } from '@web/hooks/use-space-create';
import { getDhoPathAgreements } from '@web/app/[lang]/dho/[id]/agreements/constants';
import { Locale } from '@hypha-platform/i18n';

export default function AsideCreateSpacePage() {
  const { lang } = useParams();
  const router = useRouter();
  const { createSpace, progress, isPending, isLoading, spaceSlug } =
    useSpaceCreate();

  const newSpacePath = React.useMemo(
    () => (spaceSlug ? getDhoPathAgreements(lang as Locale, spaceSlug) : null),
    [spaceSlug],
  );

  const isDone = React.useMemo(() => {
    if (!isLoading && !!newSpacePath) return true;
  }, [isLoading, newSpacePath]);

  React.useEffect(() => {
    newSpacePath ? router.prefetch(newSpacePath) : null;
  }, [newSpacePath]);

  React.useEffect(() => {
    if (!isLoading && newSpacePath) {
      router.push(newSpacePath);
    }
  }, [newSpacePath, isLoading]);

  return isDone ? null : (
    <SidePanel>
      {isPending ? (
        <Progress
          value={progress}
          className="h-1"
          indicatorColor="bg-accent-9"
        />
      ) : null}

      <CreateSpaceForm
        creator={{
          avatar: 'https://github.com/shadcn.png',
          name: 'Name',
          surname: 'Surname',
        }}
        closeUrl={`/${lang}/my-spaces`}
        onCreate={createSpace}
        isLoading={isLoading}
      />
    </SidePanel>
  );
}
