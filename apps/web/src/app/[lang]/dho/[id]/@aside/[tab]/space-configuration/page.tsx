'use client';

import {
  useJwt,
  useMe,
  useSpaceBySlug,
  useUpdateSpace,
} from '@hypha-platform/core/client';
import { ButtonClose, SidePanel, SpaceForm } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { notFound, useParams } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default function SpaceConfiguration() {
  const { person } = useMe();
  const { id: spaceSlug } = useParams<{ id: string }>();
  const { space, isLoading } = useSpaceBySlug(spaceSlug);
  const { jwt, isLoadingJwt } = useJwt();
  const { updateSpace, isMutating } = useUpdateSpace({ authToken: jwt });

  if (!space && !isLoading) {
    return notFound();
  }

  return (
    <SidePanel>
      <ButtonClose dropSegment="space-configuration" />
      {space && (
        <SpaceForm
          submitLabel="Update"
          submitLoadingLabel="Updating..."
          isLoading={isLoadingJwt || isLoading || isMutating}
          closeUrl={''}
          creator={{
            name: person?.name,
            surname: person?.surname,
          }}
          onSubmit={updateSpace}
          defaultValues={{
            ...space,
            slug: spaceSlug,
            logoUrl: space?.logoUrl || '',
            leadImage: space?.leadImage || '',
          }}
        />
      )}
    </SidePanel>
  );
}
