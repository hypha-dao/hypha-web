'use client';

import { FC } from 'react';
import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@radix-ui/react-icons';
import { SearchIcon } from 'lucide-react';
import { Button, ErrorAlert, Input } from '@hypha-platform/ui';
import {
  Coherence,
  DEFAULT_SIGNAL_WORKFLOW,
  upsertCoherenceInSpaceCache,
  usePatchCoherenceTask,
  useSignalWorkflow,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Empty } from '../../common';
import { useSignalsSection } from '../hooks';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { useCanUpdateSignalTasks } from '../hooks/use-can-update-signal-tasks';
import {
  SIGNAL_PROVISIONING_NOTICE_EVENT,
  SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
} from '../constants';
import { SignalBoardView } from './signal-board-view';
import { SignalSwimlaneView } from './signal-swimlane-view';
import { SignalListView } from './signal-list-view';
import { SignalGrid } from './signal-grid';

const SIGNAL_PROVISIONING_NOTICE_AUTO_DISMISS_MS = 8000;

type OptimisticTaskPatch = {
  progressStatus?: string | null;
  board?: string | null;
};

function applyOptimisticTaskPatches(
  items: Coherence[],
  optimisticBySlug: Record<string, OptimisticTaskPatch>,
): Coherence[] {
  if (Object.keys(optimisticBySlug).length === 0) return items;
  return items.map((signal) => {
    const slug = signal.slug?.trim();
    if (!slug) return signal;
    const patch = optimisticBySlug[slug];
    if (!patch) return signal;
    return { ...signal, ...patch };
  });
}

function patchMatchesSignal(
  signal: Coherence,
  patch: OptimisticTaskPatch,
): boolean {
  const statusOk =
    patch.progressStatus === undefined ||
    signal.progressStatus === patch.progressStatus;
  const boardOk = patch.board === undefined || signal.board === patch.board;
  return statusOk && boardOk;
}

export type SignalViewMode = 'board' | 'swimlane' | 'list' | 'grid';

type SignalSectionProps = {
  basePath: string;
  web3SpaceId: number;
  signals: Coherence[];
  leadImage?: string;
  isLoading: boolean;
  viewMode: SignalViewMode;
  order?: string;
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export const SignalSection: FC<SignalSectionProps> = ({
  basePath,
  web3SpaceId,
  signals,
  leadImage,
  isLoading,
  viewMode,
  refresh,
  onSignalClick,
}) => {
  const t = useTranslations('CoherenceTab');
  const { lang, id: spaceSlug } = useParams<{ lang: Locale; id: string }>();
  const [provisioningNoticeLines, setProvisioningNoticeLines] = React.useState<
    string[]
  >([]);
  const [optimisticBySlug, setOptimisticBySlug] = React.useState<
    Record<string, OptimisticTaskPatch>
  >({});

  const { workflow, isLoading: isWorkflowLoading } =
    useSignalWorkflow(spaceSlug);
  const { patchTask } = usePatchCoherenceTask(spaceSlug);
  const { canMutate } = useCanMutateInSpace({
    spaceId: web3SpaceId || undefined,
    spaceSlug,
  });
  const { canUpdateTasks } = useCanUpdateSignalTasks({
    spaceSlug,
    web3SpaceId,
  });

  const createSignalHref = `/${lang}/dho/${spaceSlug}/coherence/new-signal`;
  const resolvedWorkflow = workflow ?? DEFAULT_SIGNAL_WORKFLOW;

  const { onUpdateSearch, searchTerm, filteredSignals } = useSignalsSection({
    signals,
    rowBatchSize: signals.length || 1,
  });

  const readProvisioningNotice = React.useCallback(() => {
    const rawNotice = sessionStorage.getItem(
      SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
    );
    if (!rawNotice) return;
    sessionStorage.removeItem(SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY);
    try {
      const parsed = JSON.parse(rawNotice);
      if (!Array.isArray(parsed)) return;
      const lines = parsed.filter(
        (line): line is string =>
          typeof line === 'string' && line.trim().length > 0,
      );
      if (lines.length > 0) setProvisioningNoticeLines(lines);
    } catch (error) {
      console.warn('Failed to parse signal provisioning notice:', error);
    }
  }, []);

  React.useEffect(() => {
    readProvisioningNotice();
    window.addEventListener(
      SIGNAL_PROVISIONING_NOTICE_EVENT,
      readProvisioningNotice,
    );
    return () => {
      window.removeEventListener(
        SIGNAL_PROVISIONING_NOTICE_EVENT,
        readProvisioningNotice,
      );
    };
  }, [readProvisioningNotice]);

  React.useEffect(() => {
    if (provisioningNoticeLines.length === 0) return;
    const timer = window.setTimeout(
      () => setProvisioningNoticeLines([]),
      SIGNAL_PROVISIONING_NOTICE_AUTO_DISMISS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [provisioningNoticeLines]);

  const patchAndRefresh = React.useCallback(
    async (
      signal: Coherence,
      patch: {
        progressStatus?: string | null;
        board?: string | null;
        dueAt?: Date | null;
        assigneeIds?: number[];
      },
    ) => {
      const slug = signal.slug?.trim();
      if (!slug) return;

      const optimisticPatch: OptimisticTaskPatch = {};
      if (patch.progressStatus !== undefined) {
        optimisticPatch.progressStatus = patch.progressStatus;
      }
      if (patch.board !== undefined) {
        optimisticPatch.board = patch.board;
      }

      if (Object.keys(optimisticPatch).length > 0) {
        setOptimisticBySlug((prev) => ({ ...prev, [slug]: optimisticPatch }));
      }

      try {
        const updated = await patchTask({
          slug,
          ...patch,
        });
        const didUpsert = await upsertCoherenceInSpaceCache(spaceSlug, {
          ...updated,
          ...optimisticPatch,
        });
        if (!didUpsert) {
          void refresh();
        }
      } catch (error) {
        if (Object.keys(optimisticPatch).length > 0) {
          setOptimisticBySlug((prev) => {
            const next = { ...prev };
            delete next[slug];
            return next;
          });
        }
        throw error;
      }
    },
    [patchTask, refresh, spaceSlug],
  );

  const visibleSignals = filteredSignals;

  const signalsForTaskViews = React.useMemo(
    () => applyOptimisticTaskPatches(visibleSignals, optimisticBySlug),
    [optimisticBySlug, visibleSignals],
  );

  React.useEffect(() => {
    setOptimisticBySlug((current) => {
      const slugs = Object.keys(current);
      if (slugs.length === 0) return current;
      const next = { ...current };
      let changed = false;
      for (const slug of slugs) {
        const patch = current[slug];
        if (!patch) continue;
        const signal = signals.find(
          (item) => item.slug?.trim() === slug.trim(),
        );
        if (signal && patchMatchesSignal(signal, patch)) {
          delete next[slug];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [signals]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full items-center gap-2 sm:gap-3">
        <Input
          type="search"
          placeholder={t('searchSignals')}
          onChange={(event) => onUpdateSearch(event.target.value)}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="min-w-0 flex-1"
          defaultValue={searchTerm}
        />
        {canMutate ? (
          <div className="flex shrink-0 items-center">
            <Button asChild colorVariant="accent" className="whitespace-nowrap">
              <Link href={createSignalHref}>
                <PlusIcon />
                {t('newSignal')}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {provisioningNoticeLines.length > 0 ? (
        <ErrorAlert lines={provisioningNoticeLines} bgColor="bg-yellow-600" />
      ) : null}

      {isLoading || isWorkflowLoading ? null : visibleSignals.length === 0 ? (
        <Empty>
          <p>{t('listIsEmpty')}</p>
        </Empty>
      ) : viewMode === 'board' ? (
        <SignalBoardView
          signals={signalsForTaskViews}
          workflow={resolvedWorkflow}
          spaceSlug={spaceSlug}
          onSignalClick={onSignalClick}
          readOnly={!canUpdateTasks}
          refresh={refresh}
          onMoveStatus={(signal, progressStatus) =>
            patchAndRefresh(signal, { progressStatus })
          }
        />
      ) : viewMode === 'swimlane' ? (
        <SignalSwimlaneView
          signals={signalsForTaskViews}
          workflow={resolvedWorkflow}
          onSignalClick={onSignalClick}
          readOnly={!canUpdateTasks}
          refresh={refresh}
          onPatch={patchAndRefresh}
        />
      ) : viewMode === 'list' ? (
        <SignalListView
          signals={signalsForTaskViews}
          workflow={resolvedWorkflow}
          onSignalClick={onSignalClick}
          readOnly={!canUpdateTasks}
          refresh={refresh}
          onPatch={patchAndRefresh}
        />
      ) : (
        <SignalGrid
          isLoading={false}
          basePath={basePath}
          leadImage={leadImage}
          signals={visibleSignals}
          refresh={refresh}
          onSignalClick={onSignalClick}
        />
      )}
    </div>
  );
};
