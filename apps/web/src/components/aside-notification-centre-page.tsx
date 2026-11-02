'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import {
  NotificationCentreForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { useNotifications } from '@hypha-platform/notifications/client';
import { LoadingBackdrop } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export default function AsideNotificationCentrePage({
  closeUrl,
  onClose,
}: {
  closeUrl: string;
  onClose?: () => void;
}) {
  const tNotificationCentre = useTranslations('NotificationCentre');
  const { person, isLoading } = useMe();
  const {
    isAuthenticated,
    isLoading: authLoading,
    getAccessToken,
  } = useAuthentication();
  const {
    subscribed,
    pushActive,
    pushStateReady,
    subscribe,
    unsubscribe,
    enableBrowserPush,
    error,
    configuration,
    saveConfigurations,
  } = useNotifications({
    person: person ?? undefined,
    isLoading,
    getAccessToken,
  });
  const progress = 0;
  const isBusy = isLoading;
  return (
    <ProposalOverlayShell elevated>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        keepWindowOpenMessage={tNotificationCentre('loading.keepWindowOpen')}
        fullHeight={true}
        progress={progress}
        isLoading={isBusy}
        message={<></>}
      >
        <NotificationCentreForm
          person={person ?? undefined}
          closeUrl={closeUrl}
          onClose={onClose}
          isLoading={isBusy}
          signedOut={!authLoading && !isAuthenticated}
          error={error}
          subscribed={subscribed}
          pushActive={pushActive}
          pushStateReady={pushStateReady}
          enableBrowserPush={enableBrowserPush}
          subscribe={subscribe}
          unsubscribe={unsubscribe}
          configuration={configuration}
          saveConfigurations={saveConfigurations}
        />
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
