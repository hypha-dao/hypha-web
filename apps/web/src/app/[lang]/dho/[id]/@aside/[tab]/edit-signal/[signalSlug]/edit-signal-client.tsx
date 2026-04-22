'use client';

import { EditSignalForm, ProposalOverlayShell } from '@hypha-platform/epics';
import type { Coherence } from '@hypha-platform/core/client';
import { useJwt } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { notFound, useParams } from 'next/navigation';
import React from 'react';
import { useTranslations } from 'next-intl';

type EditSignalClientProps = {
  coherenceUrl: string;
};

export function EditSignalClient({ coherenceUrl }: EditSignalClientProps) {
  const { signalSlug } = useParams<{
    lang: Locale;
    id: string;
    tab: string;
    signalSlug: string;
  }>();
  const { jwt, isLoadingJwt } = useJwt();
  const t = useTranslations('CoherenceTab');

  const [signal, setSignal] = React.useState<Coherence | null | undefined>(
    undefined,
  );

  React.useEffect(() => {
    let cancelled = false;
    if (isLoadingJwt) return;
    if (!jwt) {
      setSignal(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/coherence/${encodeURIComponent(signalSlug)}/for-edit`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (!res.ok) {
          if (!cancelled) setSignal(null);
          return;
        }
        const data = (await res.json()) as Coherence;
        if (!cancelled) setSignal(data);
      } catch {
        if (!cancelled) setSignal(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt, isLoadingJwt, signalSlug]);

  if (signal === undefined) {
    return (
      <ProposalOverlayShell>
        <div className="p-6 text-sm text-muted-foreground">
          {t('editSignalLoading')}
        </div>
      </ProposalOverlayShell>
    );
  }

  if (signal === null) {
    notFound();
  }

  return (
    <ProposalOverlayShell>
      <EditSignalForm
        slug={signalSlug}
        signal={signal}
        successfulUrl={coherenceUrl}
        closeUrl={coherenceUrl}
        backUrl={coherenceUrl}
      />
    </ProposalOverlayShell>
  );
}
