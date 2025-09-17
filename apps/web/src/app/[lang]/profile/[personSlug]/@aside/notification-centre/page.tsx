'use client';

import { NotificationCentreForm, SidePanel } from '@hypha-platform/epics';
import { Button, LoadingBackdrop } from '@hypha-platform/ui';

export default function NotificationCentre() {
  const progress = 0;
  const isBusy = false;
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
        <NotificationCentreForm />
      </LoadingBackdrop>
    </SidePanel>
  );
}
