'use client';

import { EditPersonSection, SidePanel } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';
import { useJwt } from '@hypha-platform/core/client';
import { useEditPersonOrchestrator } from '@hypha-platform/core/client';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function EditProfilePage() {
  const { lang } = useParams();
  const { person, isLoading } = useMe();
  const { jwt } = useJwt();
  const router = useRouter();

  const { editPerson, reset, currentAction, isError, isPending, progress } =
    useEditPersonOrchestrator({ authToken: jwt });

  React.useEffect(() => {
    if (progress === 100) {
      router.push(`/${lang}/profile/`);
    }
  }, [progress]);

  return (
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isPending}
        message={
          isError ? (
            <div className="flex flex-col">
              <div>Ouh Snap. There was an error</div>
              <Button onClick={reset}>Reset</Button>
            </div>
          ) : (
            <div>{currentAction}</div>
          )
        }
        className="-m-9"
      >
        <EditPersonSection
          person={person}
          closeUrl={`/${lang}/profile/`}
          isLoading={isLoading}
          onEdit={editPerson}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
