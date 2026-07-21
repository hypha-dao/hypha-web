'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Label } from '@hypha-platform/ui';
import type { HighlightsProfile } from '@hypha-platform/core/client';

type HighlightsPublishPanelProps = {
  spaceSlug: string;
  profile: HighlightsProfile;
  authToken?: string | null;
  onUpdated: () => void;
};

export function HighlightsPublishPanel({
  spaceSlug,
  profile,
  authToken,
  onUpdated,
}: HighlightsPublishPanelProps) {
  const t = useTranslations('HighlightsTab');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const togglePublish = async (published: boolean) => {
    if (!authToken) return;
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch(
        `/api/v1/spaces/${spaceSlug}/highlights/publish`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ published }),
        },
      );
      const body = (await res.json().catch(() => null)) as {
        errors?: string[];
        error?: string;
      } | null;
      if (!res.ok) {
        setErrors(body?.errors ?? [body?.error ?? t('publish.failed')]);
        return;
      }
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-background-2 p-4">
      <h3 className="text-3 font-medium text-foreground">
        {t('publish.title')}
      </h3>
      <p className="mt-1 text-1 text-neutral-11">{t('publish.description')}</p>
      <div className="mt-4 flex items-center gap-3">
        <Checkbox
          id="highlights-publish"
          checked={profile.published}
          disabled={busy}
          onCheckedChange={(checked) => {
            void togglePublish(checked === true);
          }}
        />
        <Label htmlFor="highlights-publish">
          {t('publish.shareOnMarketplace')}
        </Label>
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-1 text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {profile.published && (
        <Button
          className="mt-3"
          variant="outline"
          disabled={busy}
          onClick={() => void togglePublish(false)}
        >
          {t('publish.unpublish')}
        </Button>
      )}
    </section>
  );
}
