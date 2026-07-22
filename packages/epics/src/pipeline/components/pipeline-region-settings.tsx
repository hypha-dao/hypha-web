'use client';

import React from 'react';
import {
  DEFAULT_PIPELINE_REGIONS,
  usePipelineConfig,
} from '@hypha-platform/core/client';
import { Button, Input, Separator } from '@hypha-platform/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type PipelineRegionSettingsProps = {
  spaceSlug: string;
};

export function PipelineRegionSettings({
  spaceSlug,
}: PipelineRegionSettingsProps) {
  const t = useTranslations('Pipeline');
  const { regions, defaultRegion, isLoading, saveConfig, isSaving } =
    usePipelineConfig(spaceSlug);
  const [draft, setDraft] = React.useState<string[]>([...regions]);
  const [defaultDraft, setDefaultDraft] = React.useState(defaultRegion);
  const [newRegion, setNewRegion] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setDraft([...regions]);
    setDefaultDraft(defaultRegion);
  }, [regions, defaultRegion]);

  const addRegion = () => {
    const name = newRegion.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (draft.some((r) => r.toLowerCase() === name.toLowerCase())) {
      setError(t('regions.duplicate'));
      return;
    }
    setDraft((prev) => [...prev, name]);
    setNewRegion('');
    setError(null);
  };

  const removeRegion = (name: string) => {
    if (draft.length <= 1) {
      setError(t('regions.atLeastOne'));
      return;
    }
    const next = draft.filter((r) => r !== name);
    setDraft(next);
    if (defaultDraft === name) {
      setDefaultDraft(next[0] ?? 'Global');
    }
    setError(null);
  };

  const resetDefaults = () => {
    setDraft([...DEFAULT_PIPELINE_REGIONS]);
    setDefaultDraft('Benelux');
    setError(null);
  };

  const save = async () => {
    if (draft.length < 1) {
      setError(t('regions.atLeastOne'));
      return;
    }
    try {
      await saveConfig({
        regions: draft,
        defaultRegion: defaultDraft,
      });
      setSavedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('regions.saveFailed'));
    }
  };

  if (isLoading) {
    return <div className="text-1 text-neutral-11">{t('regions.loading')}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-2 font-medium text-neutral-12">
          {t('regions.title')}
        </h3>
        <p className="mt-1 text-1 text-neutral-11">
          {t('regions.description')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {draft.map((region) => (
          <div
            key={region}
            className="flex items-center gap-2 rounded-lg border border-neutral-5 px-3 py-2"
          >
            <span className="min-w-0 flex-1 text-2 text-neutral-12">
              {region}
            </span>
            <label className="flex items-center gap-1.5 text-1 text-neutral-11">
              <input
                type="radio"
                name="pipeline-default-region"
                checked={defaultDraft === region}
                onChange={() => setDefaultDraft(region)}
              />
              {t('regions.default')}
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeRegion(region)}
              aria-label={t('regions.remove')}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[180px] flex-1"
          value={newRegion}
          placeholder={t('regions.addPlaceholder')}
          onChange={(e) => setNewRegion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addRegion();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addRegion}>
          <Plus className="mr-1 size-3.5" />
          {t('regions.add')}
        </Button>
      </div>

      {error ? (
        <p className="text-1 text-red-11" role="alert">
          {error}
        </p>
      ) : savedAt ? (
        <p className="text-1 text-neutral-11">{t('regions.saved')}</p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={resetDefaults}>
          {t('regions.resetDefaults')}
        </Button>
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving ? t('saving') : t('regions.save')}
        </Button>
      </div>
      <Separator />
    </div>
  );
}
