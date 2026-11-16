'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';

/**
 * What a read-only pipeline shows when its config could not be read: members
 * only (the request was refused) or a failed load. Never lanes, stage labels or
 * "Open track" links built from the default config, which would be wrong for a
 * Space with custom tracks.
 */
export function PipelineUnavailable({
  refused,
  onRetry,
}: {
  /** The config request was refused (anonymous or not a member). */
  refused: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations('Pipeline');
  const { canLogin, isAuthenticated, login } = useAuthentication();

  if (!refused) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-6 bg-red-2 px-3 py-2 text-2 text-red-11"
        role="alert"
      >
        <span>{t('configLoadFailed')}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-3 py-10 text-center"
      data-testid="pipeline-members-only"
    >
      <p className="text-3 text-foreground">{t('membersOnly')}</p>
      {canLogin && !isAuthenticated ? (
        <>
          <p className="text-2 text-muted-foreground">
            {t('membersOnlySignIn')}
          </p>
          <Button type="button" onClick={() => void login()}>
            {t('signIn')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
