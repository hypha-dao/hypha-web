'use client';

import React from 'react';
import {
  DEFAULT_PIPELINE_TRACKS,
  usePipelineConfig,
  type PipelineTrackDefinition,
} from '@hypha-platform/core/client';
import { Button, Input, Separator } from '@hypha-platform/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PipelineConfigRow } from './pipeline-config-row';

type PipelineTrackSettingsProps = {
  spaceSlug: string;
};

function uniqueSlug(base: string, existing: Set<string>): string {
  const normalized =
    base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'track';
  if (!existing.has(normalized)) return normalized;
  let counter = 2;
  while (existing.has(`${normalized}_${counter}`)) {
    counter += 1;
  }
  return `${normalized}_${counter}`.slice(0, 64);
}

function cloneTracks(
  tracks: PipelineTrackDefinition[],
): PipelineTrackDefinition[] {
  return tracks.map((track, position) => ({ ...track, position }));
}

export function PipelineTrackSettings({
  spaceSlug,
}: PipelineTrackSettingsProps) {
  const t = useTranslations('Pipeline');
  const {
    tracks,
    isLoading,
    error: configError,
    saveConfig,
    isSaving,
  } = usePipelineConfig(spaceSlug);
  const [draft, setDraft] = React.useState<PipelineTrackDefinition[]>(() =>
    cloneTracks(tracks),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const hasLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasLoadedRef.current || isLoading || configError) return;
    hasLoadedRef.current = true;
    setDraft(cloneTracks(tracks));
  }, [tracks, isLoading, configError]);

  const move = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((track, position) => ({ ...track, position }));
    });
    setSavedAt(null);
  };

  const rename = (index: number, name: string) => {
    setDraft((current) =>
      current.map((track, i) => (i === index ? { ...track, name } : track)),
    );
    setSavedAt(null);
  };

  const addTrack = () => {
    setDraft((current) => {
      const slugs = new Set(current.map((track) => track.slug));
      const slug = uniqueSlug('new_track', slugs);
      return [
        ...current,
        {
          slug,
          name: t('tracks.newTrack'),
          position: current.length,
        },
      ];
    });
    setSavedAt(null);
  };

  const removeTrack = (index: number) => {
    setDraft((current) => {
      if (current.length <= 1) return current;
      return current
        .filter((_, i) => i !== index)
        .map((track, position) => ({ ...track, position }));
    });
    setSavedAt(null);
  };

  const resetDefaults = () => {
    setDraft(cloneTracks(DEFAULT_PIPELINE_TRACKS));
    setError(null);
    setSavedAt(null);
  };

  const save = async () => {
    if (draft.length < 1) {
      setError(t('tracks.atLeastOne'));
      return;
    }
    if (draft.some((track) => !track.name.trim())) {
      setError(t('tracks.nameRequired'));
      return;
    }
    try {
      await saveConfig({
        tracks: draft.map((track, position) => ({
          ...track,
          name: track.name.trim(),
          position,
        })),
      });
      setSavedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tracks.saveFailed'));
    }
  };

  if (isLoading) {
    return <div className="text-1 text-neutral-11">{t('tracks.loading')}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-2 font-medium text-neutral-12">
            {t('tracks.title')}
          </h3>
          <p className="mt-1 text-1 text-neutral-11">
            {t('tracks.description')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addTrack}>
          <Plus className="size-4" />
          {t('tracks.add')}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {draft.map((track, index) => (
          <PipelineConfigRow
            key={track.slug}
            label={track.name}
            index={index}
            total={draft.length}
            onMoveUp={() => move(index, -1)}
            onMoveDown={() => move(index, 1)}
            onRemove={() => removeTrack(index)}
            disableRemove={draft.length <= 1}
          >
            <Input
              value={track.name}
              onChange={(event) => rename(index, event.target.value)}
              placeholder={t('tracks.namePlaceholder')}
              aria-label={t('tracks.namePlaceholder')}
            />
          </PipelineConfigRow>
        ))}
      </div>

      {error ? (
        <p className="text-1 text-red-11" role="alert">
          {error}
        </p>
      ) : savedAt ? (
        <p className="text-1 text-neutral-11">{t('tracks.saved')}</p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={resetDefaults}>
          {t('tracks.resetDefaults')}
        </Button>
        <Button
          type="button"
          disabled={isSaving || Boolean(configError)}
          onClick={save}
        >
          {isSaving ? t('saving') : t('tracks.save')}
        </Button>
      </div>
      <Separator />
    </div>
  );
}
