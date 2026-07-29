'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Skeleton } from '@hypha-platform/ui';
import { useHighlightProfile } from '../hooks/use-highlight-profile';
import { HighlightsBlockEditor } from './highlights-block-editor';
import { HighlightsStoriesSection } from './highlights-stories-section';
import { HighlightsSupportBar } from './highlights-support-bar';
import { HighlightsPublishPanel } from './highlights-publish-panel';

type HighlightsPageProps = {
  spaceSlug: string;
};

export function HighlightsPage({ spaceSlug }: HighlightsPageProps) {
  const t = useTranslations('HighlightsTab');
  const { data, error, isLoading, mutate, authToken } =
    useHighlightProfile(spaceSlug);
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-8 text-2 text-neutral-11">
        {error?.message ?? t('loadError')}
      </div>
    );
  }

  const cover =
    data.profile?.coverImageUrl || data.space.leadImage || data.space.logoUrl;

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-col gap-4">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-40 w-full rounded-xl object-cover md:h-56"
          />
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-5 font-medium text-foreground">
              {data.space.title}
            </h2>
            {data.space.locationLabel ? (
              <p className="mt-1 text-2 text-neutral-11">
                {data.space.locationLabel}
              </p>
            ) : null}
            {data.profile?.summary ? (
              <p className="mt-2 max-w-2xl text-2 text-neutral-11">
                {data.profile.summary}
              </p>
            ) : null}
          </div>
          {data.canEdit ? (
            <Button
              variant={editing ? 'outline' : 'default'}
              colorVariant={editing ? 'neutral' : 'accent'}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? t('doneEditing') : t('edit')}
            </Button>
          ) : null}
        </div>
      </div>

      {data.profile ? (
        <HighlightsSupportBar spaceSlug={spaceSlug} profile={data.profile} />
      ) : null}

      <HighlightsBlockEditor
        spaceSlug={spaceSlug}
        profile={data.profile}
        authToken={authToken}
        editing={editing && data.canEdit}
        onSaved={() => {
          void mutate();
          setEditing(false);
        }}
      />

      <HighlightsStoriesSection
        spaceSlug={spaceSlug}
        stories={data.stories}
        canEdit={data.canEdit}
        onCreated={() => {
          void mutate();
        }}
      />

      {data.canEdit && data.profile ? (
        <HighlightsPublishPanel
          spaceSlug={spaceSlug}
          profile={data.profile}
          authToken={authToken}
          onUpdated={() => {
            void mutate();
          }}
        />
      ) : null}
    </div>
  );
}
