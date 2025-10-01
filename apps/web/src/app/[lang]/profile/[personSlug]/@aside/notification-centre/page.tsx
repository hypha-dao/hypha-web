'use client';

import { useMe } from '@hypha-platform/core/client';
import { NotificationCentreForm, SidePanel } from '@hypha-platform/epics';
import { useNotifications } from '@hypha-platform/notifications/client';
import { Button, LoadingBackdrop } from '@hypha-platform/ui';
import { useParams } from 'next/navigation';

export default function NotificationCentre() {
  const { lang, personSlug } = useParams();
  const { isLoading: isPersonLoading } = useMe();
  const {
    subscribed,
    subscribe,
    unsubscribe,
    error,
    configuration,
    saveConfigurations,
  } = useNotifications();
  const progress = 0;
  const isBusy = isPersonLoading;
  const isError = undefined;
  const reset = () => {};
  const currentAction = undefined;
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
          subscribed={subscribed}
          subscribe={subscribe}
          unsubscribe={unsubscribe}
          configuration={configuration}
          saveConfigurations={saveConfigurations}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
