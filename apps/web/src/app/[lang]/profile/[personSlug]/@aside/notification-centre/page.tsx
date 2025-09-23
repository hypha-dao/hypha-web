'use client';

import { useMe } from '@hypha-platform/core/client';
import { NotificationCentreForm, SidePanel } from '@hypha-platform/epics';
import { Button, LoadingBackdrop } from '@hypha-platform/ui';
import { notFound, useParams } from 'next/navigation';

export default function NotificationCentre() {
  const { lang, personSlug } = useParams();
  const { person, isLoading } = useMe();
  if (!isLoading && !person) {
    return notFound();
  }
  const progress = 0;
  const isBusy = isLoading;
  const isError = undefined;
  const reset = () => {};
  const currentAction = undefined;
  const error = '';
  return (
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isBusy}
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
        className="-m-4 lg:-m-7"
      >
        <NotificationCentreForm
          closeUrl={`/${lang}/profile/${personSlug}`}
          isLoading={isBusy}
          error={error}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
