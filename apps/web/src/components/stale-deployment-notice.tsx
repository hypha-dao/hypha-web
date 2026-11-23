'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FloatingNotice } from '@hypha-platform/ui';
import {
  installStaleDeploymentListeners,
  refreshNow,
  useStaleDeploymentStatus,
  workInProgress,
} from '@hypha-platform/core/client';
import { isProposalCreateFormPath } from '@hypha-platform/epics';

/**
 * Shown when this tab runs an older build than the server (a Server Action
 * was "not found"). Idle tabs get a short notice and reload by themselves;
 * tabs with work in progress get a banner and refresh when the user chooses.
 * Also installs the browser listeners the detection needs.
 */
export function StaleDeploymentNotice() {
  const t = useTranslations('StaleDeployment');
  const status = useStaleDeploymentStatus();
  // Dismissing only hides the notice (so it never blocks a submit button); the
  // leave prompt for unsaved work stays on.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const removeProbe = workInProgress.addProbe(() =>
      isProposalCreateFormPath(window.location.pathname),
    );
    const removeListeners = installStaleDeploymentListeners();
    return () => {
      removeProbe();
      removeListeners();
    };
  }, []);

  if (status === 'reloading') {
    return (
      <FloatingNotice withIcon title={t('reloadingTitle')}>
        {t('reloading')}
      </FloatingNotice>
    );
  }
  if (status === 'banner' && !dismissed) {
    return (
      <FloatingNotice
        variant="warning"
        title={t('title')}
        action={
          // A text link, not a button, so it is not mistaken for page actions.
          <button
            type="button"
            onClick={refreshNow}
            className="font-semibold underline underline-offset-4 hover:no-underline"
          >
            {t('refresh')}
          </button>
        }
        onDismiss={() => setDismissed(true)}
        dismissLabel={t('dismiss')}
      >
        {t('description')}
      </FloatingNotice>
    );
  }
  return null;
}
