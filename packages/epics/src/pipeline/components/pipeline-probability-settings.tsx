'use client';

import React from 'react';
import {
  defaultProbabilityMatrix,
  DEFAULT_PIPELINE_STAGES,
  seedStageProbability,
  terminalProbabilityForStage,
  usePipelineConfig,
  type PipelineStageDefinition,
  type ProbabilityMatrix,
} from '@hypha-platform/core/client';
import { Button, Input, Separator } from '@hypha-platform/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PipelineConfigRow } from './pipeline-config-row';

type PipelineProbabilitySettingsProps = {
  spaceSlug: string;
};

function cloneMatrix(
  matrix: ProbabilityMatrix,
  tracks: { slug: string }[],
  stages: PipelineStageDefinition[],
): ProbabilityMatrix {
  const clone: ProbabilityMatrix = {};
  for (const track of tracks) {
    const lane: Record<string, number> = {};
    for (const stage of stages) {
      const terminal = terminalProbabilityForStage(stage);
      lane[stage.slug] =
        terminal ??
        matrix[track.slug]?.[stage.slug] ??
        seedStageProbability(track.slug, stage.slug);
    }
    clone[track.slug] = lane;
  }
  return clone;
}

function uniqueSlug(base: string, existing: Set<string>): string {
  const normalized =
    base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'stage';
  if (!existing.has(normalized)) return normalized;
  let counter = 2;
  while (existing.has(`${normalized}_${counter}`)) {
    counter += 1;
  }
  return `${normalized}_${counter}`.slice(0, 64);
}

function cloneStages(
  stages: PipelineStageDefinition[],
): PipelineStageDefinition[] {
  return stages.map((stage, position) => ({ ...stage, position }));
}

/** Tracks whose non-terminal stages are not monotonically increasing. */
function nonMonotonicTracks(
  matrix: ProbabilityMatrix,
  tracks: { slug: string; name: string }[],
  stages: PipelineStageDefinition[],
): string[] {
  const openStages = stages.filter(
    (stage) => terminalProbabilityForStage(stage) === undefined,
  );
  return tracks
    .filter((track) => {
      for (let i = 1; i < openStages.length; i += 1) {
        const current = matrix[track.slug]?.[openStages[i]!.slug] ?? 0;
        const previous = matrix[track.slug]?.[openStages[i - 1]!.slug] ?? 0;
        if (current < previous) return true;
      }
      return false;
    })
    .map((track) => track.name);
}

export function PipelineProbabilitySettings({
  spaceSlug,
}: PipelineProbabilitySettingsProps) {
  const t = useTranslations('Pipeline');
  const { tracks, stages, probabilities, isLoading, saveConfig, isSaving } =
    usePipelineConfig(spaceSlug);
  const [stageDraft, setStageDraft] = React.useState<PipelineStageDefinition[]>(
    () => cloneStages(stages),
  );
  const [draft, setDraft] = React.useState<ProbabilityMatrix>(() =>
    cloneMatrix(probabilities, tracks, stages),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const hasLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (hasLoadedRef.current || isLoading) return;
    hasLoadedRef.current = true;
    setStageDraft(cloneStages(stages));
    setDraft(cloneMatrix(probabilities, tracks, stages));
  }, [probabilities, stages, tracks, isLoading]);

  const setCell = (trackSlug: string, stageSlug: string, raw: string) => {
    const n = raw === '' ? 0 : Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    setDraft((prev) => ({
      ...prev,
      [trackSlug]: {
        ...prev[trackSlug],
        [stageSlug]: Math.min(100, Math.max(0, n)),
      },
    }));
    setSavedAt(null);
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    setStageDraft((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((stage, position) => ({ ...stage, position }));
    });
    setSavedAt(null);
  };

  const renameStage = (index: number, name: string) => {
    setStageDraft((current) =>
      current.map((stage, i) => (i === index ? { ...stage, name } : stage)),
    );
    setSavedAt(null);
  };

  const addStage = () => {
    setStageDraft((current) => {
      const slugs = new Set(current.map((stage) => stage.slug));
      const slug = uniqueSlug('new_stage', slugs);
      const next = [
        ...current,
        {
          slug,
          name: t('stages.newStage'),
          position: current.length,
        },
      ];
      setDraft((matrix) => {
        const updated: ProbabilityMatrix = {};
        for (const track of tracks) {
          updated[track.slug] = {
            ...(matrix[track.slug] ?? {}),
            [slug]: seedStageProbability(track.slug, slug),
          };
        }
        return updated;
      });
      return next;
    });
    setSavedAt(null);
  };

  const removeStage = (index: number) => {
    setStageDraft((current) => {
      if (current.length <= 1) return current;
      const removed = current[index];
      const next = current
        .filter((_, i) => i !== index)
        .map((stage, position) => ({ ...stage, position }));
      if (removed) {
        setDraft((matrix) => {
          const updated: ProbabilityMatrix = {};
          for (const [trackSlug, lane] of Object.entries(matrix)) {
            const { [removed.slug]: _dropped, ...rest } = lane;
            updated[trackSlug] = rest;
          }
          return updated;
        });
      }
      return next;
    });
    setSavedAt(null);
  };

  const resetDefaults = () => {
    const nextStages = cloneStages(DEFAULT_PIPELINE_STAGES);
    setStageDraft(nextStages);
    setDraft(defaultProbabilityMatrix(tracks, nextStages));
    setError(null);
    setSavedAt(null);
  };

  const save = async () => {
    if (stageDraft.length < 1) {
      setError(t('stages.atLeastOne'));
      return;
    }
    if (stageDraft.some((stage) => !stage.name.trim())) {
      setError(t('stages.nameRequired'));
      return;
    }
    try {
      const stagesToSave = stageDraft.map((stage, position) => ({
        ...stage,
        name: stage.name.trim(),
        position,
      }));
      await saveConfig({
        stages: stagesToSave,
        probabilities: cloneMatrix(draft, tracks, stagesToSave),
      });
      setSavedAt(new Date());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('probabilities.saveFailed'),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="text-1 text-neutral-11">{t('probabilities.loading')}</div>
    );
  }

  const warningTracks = nonMonotonicTracks(draft, tracks, stageDraft);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-2 font-medium text-neutral-12">
          {t('probabilities.title')}
        </h3>
        <p className="mt-1 text-1 text-neutral-11">
          {t('probabilities.description')}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-1 text-neutral-11">{t('stages.description')}</p>
        <Button type="button" variant="outline" size="sm" onClick={addStage}>
          <Plus className="size-4" />
          {t('stages.add')}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {stageDraft.map((stage, index) => (
          <PipelineConfigRow
            key={stage.slug}
            index={index}
            total={stageDraft.length}
            onMoveUp={() => moveStage(index, -1)}
            onMoveDown={() => moveStage(index, 1)}
            onRemove={() => removeStage(index)}
            disableRemove={stageDraft.length <= 1}
          >
            <Input
              value={stage.name}
              onChange={(event) => renameStage(index, event.target.value)}
              placeholder={t('stages.namePlaceholder')}
              aria-label={t('stages.namePlaceholder')}
            />
          </PipelineConfigRow>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-1">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-neutral-11">
                {t('probabilities.track')}
              </th>
              {stageDraft.map((stage) => (
                <th
                  key={stage.slug}
                  className="px-2 py-1.5 text-left font-medium text-neutral-11"
                >
                  {stage.name || stage.slug}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr key={track.slug} className="border-t border-neutral-5">
                <td className="px-2 py-1.5 font-medium text-neutral-12">
                  {track.name}
                </td>
                {stageDraft.map((stage) => {
                  const terminalValue = terminalProbabilityForStage(stage);
                  const terminal = terminalValue !== undefined;
                  return (
                    <td key={stage.slug} className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        className="w-16"
                        value={
                          terminal
                            ? terminalValue
                            : draft[track.slug]?.[stage.slug] ?? 0
                        }
                        disabled={terminal}
                        title={
                          terminal ? t('probabilities.terminalHint') : undefined
                        }
                        onChange={(e) =>
                          setCell(track.slug, stage.slug, e.target.value)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-1 text-neutral-10">
        {t('probabilities.terminalHint')}
      </p>

      {warningTracks.length > 0 ? (
        <p className="text-1 text-amber-11" role="alert">
          {t('probabilities.monotonicWarning', {
            lanes: warningTracks.join(', '),
          })}
        </p>
      ) : null}

      {error ? (
        <p className="text-1 text-red-11" role="alert">
          {error}
        </p>
      ) : savedAt ? (
        <p className="text-1 text-neutral-11">{t('probabilities.saved')}</p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={resetDefaults}>
          {t('probabilities.resetDefaults')}
        </Button>
        <Button type="button" disabled={isSaving} onClick={save}>
          {isSaving ? t('saving') : t('probabilities.save')}
        </Button>
      </div>
      <Separator />
    </div>
  );
}
