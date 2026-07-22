'use client';

import React from 'react';
import {
  defaultProbabilityMatrix,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
  usePipelineConfig,
  type PipelineStatus,
  type PipelineSwimlane,
  type ProbabilityMatrix,
} from '@hypha-platform/core/client';
import { Button, Input, Separator } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type PipelineProbabilitySettingsProps = {
  spaceSlug: string;
};

const TERMINAL: Record<string, number> = { Won: 100, Lost: 0 };

function cloneMatrix(matrix: ProbabilityMatrix): ProbabilityMatrix {
  const clone = {} as ProbabilityMatrix;
  for (const swimlane of PIPELINE_SWIMLANES) {
    clone[swimlane] = { ...matrix[swimlane] };
  }
  return clone;
}

/** Lanes whose non-terminal stages are not monotonically increasing. */
function nonMonotonicLanes(matrix: ProbabilityMatrix): PipelineSwimlane[] {
  const stages = PIPELINE_STATUSES.filter((s) => !(s in TERMINAL));
  return PIPELINE_SWIMLANES.filter((swimlane) => {
    for (let i = 1; i < stages.length; i += 1) {
      if (matrix[swimlane][stages[i]!] < matrix[swimlane][stages[i - 1]!]) {
        return true;
      }
    }
    return false;
  });
}

export function PipelineProbabilitySettings({
  spaceSlug,
}: PipelineProbabilitySettingsProps) {
  const t = useTranslations('Pipeline');
  const { probabilities, isLoading, saveConfig, isSaving } =
    usePipelineConfig(spaceSlug);
  const [draft, setDraft] = React.useState<ProbabilityMatrix>(() =>
    cloneMatrix(probabilities),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setDraft(cloneMatrix(probabilities));
  }, [probabilities]);

  const setCell = (
    swimlane: PipelineSwimlane,
    status: PipelineStatus,
    raw: string,
  ) => {
    const n = raw === '' ? 0 : Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    setDraft((prev) => ({
      ...prev,
      [swimlane]: {
        ...prev[swimlane],
        [status]: Math.min(100, Math.max(0, n)),
      },
    }));
    setSavedAt(null);
  };

  const resetDefaults = () => {
    setDraft(defaultProbabilityMatrix());
    setError(null);
    setSavedAt(null);
  };

  const save = async () => {
    try {
      await saveConfig({ probabilities: draft });
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

  const warningLanes = nonMonotonicLanes(draft);

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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-1">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-neutral-11">
                {t('probabilities.track')}
              </th>
              {PIPELINE_STATUSES.map((status) => (
                <th
                  key={status}
                  className="px-2 py-1.5 text-left font-medium text-neutral-11"
                >
                  {status}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PIPELINE_SWIMLANES.map((swimlane) => (
              <tr key={swimlane} className="border-t border-neutral-5">
                <td className="px-2 py-1.5 font-medium text-neutral-12">
                  {swimlane}
                </td>
                {PIPELINE_STATUSES.map((status) => {
                  const terminal = status in TERMINAL;
                  return (
                    <td key={status} className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        className="w-16"
                        value={
                          terminal ? TERMINAL[status]! : draft[swimlane][status]
                        }
                        disabled={terminal}
                        title={
                          terminal ? t('probabilities.terminalHint') : undefined
                        }
                        onChange={(e) =>
                          setCell(swimlane, status, e.target.value)
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

      {warningLanes.length > 0 ? (
        <p className="text-1 text-amber-11" role="alert">
          {t('probabilities.monotonicWarning', {
            lanes: warningLanes.join(', '),
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
