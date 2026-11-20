'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button, FloatingNotice } from '@hypha-platform/ui';
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
    return <FloatingNotice>{t('reloading')}</FloatingNotice>;
  }
  if (status === 'banner') {
    return (
      <FloatingNotice
        title={t('title')}
        action={<Button onClick={refreshNow}>{t('refresh')}</Button>}
      >
        {t('description')}
      </FloatingNotice>
    );
  }
  return null;
}
