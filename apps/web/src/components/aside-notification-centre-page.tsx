'use client';

import { useMe } from '@hypha-platform/core/client';
import {
  NotificationCentreForm,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { useNotifications } from '@hypha-platform/notifications/client';
import { LoadingBackdrop } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function AsideNotificationCentrePage() {
  const tNotificationCentre = useTranslations('NotificationCentre');
  const { person, isLoading } = useMe();
  const pathname = usePathname();
  const closeUrl = pathname.substring(0, pathname.lastIndexOf('/'));
  const {
    subscribed,
    subscribe,
    unsubscribe,
    error,
    configuration,
    saveConfigurations,
  } = useNotifications({ person: person ?? undefined, isLoading });
  const progress = 0;
  const isBusy = isLoading;
  return (
    <ProposalOverlayShell>
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
          isLoading={isBusy}
          error={error}
          subscribed={subscribed}
          subscribe={subscribe}
          unsubscribe={unsubscribe}
          configuration={configuration}
          saveConfigurations={saveConfigurations}
        />
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
