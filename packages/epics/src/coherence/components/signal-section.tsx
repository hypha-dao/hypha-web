'use client';

import { FC, ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@radix-ui/react-icons';
import { SearchIcon } from 'lucide-react';
import {
  Button,
  Checkbox,
  ErrorAlert,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import {
  Coherence,
  DEFAULT_SIGNAL_WORKFLOW,
  usePatchCoherenceTask,
  useSignalWorkflow,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Empty } from '../../common';
import { useSignalsSection } from '../hooks';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import {
  SIGNAL_PROVISIONING_NOTICE_EVENT,
  SIGNAL_PROVISIONING_NOTICE_STORAGE_KEY,
} from '../constants';
import { SignalBoardView } from './signal-board-view';
import { SignalSwimlaneView } from './signal-swimlane-view';
import { SignalListView } from './signal-list-view';
import { SignalGrid } from './signal-grid';

const SIGNAL_PROVISIONING_NOTICE_AUTO_DISMISS_MS = 8000;

type SignalViewMode = 'board' | 'swimlane' | 'list' | 'grid';

type SignalSectionProps = {
  basePath: string;
  web3SpaceId: number;
  signals: Coherence[];
  leadImage?: string;
  toolbarLeft?: ReactNode;
  isLoading: boolean;
  hideArchived: boolean;
  setHideArchived: (checked: boolean) => void;
  order?: string;
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export const SignalSection: FC<SignalSectionProps> = ({
  basePath,
  web3SpaceId,
  signals,
  leadImage,
  toolbarLeft,
  isLoading,
  hideArchived,
  setHideArchived,
  refresh,
  onSignalClick,
}) => {
  const t = useTranslations('CoherenceTab');
  const { lang, id: spaceSlug } = useParams<{ lang: Locale; id: string }>();
  const [viewMode, setViewMode] = React.useState<SignalViewMode>('board');
  const [provisioningNoticeLines, setProvisioningNoticeLines] = React.useState<
    string[]
  >([]);

  const { workflow, isLoading: isWorkflowLoading } =
    useSignalWorkflow(spaceSlug);
  const { patchTask } = usePatchCoherenceTask(spaceSlug);
  const { canMutate } = useCanMutateInSpace({ spaceId: web3SpaceId });

  const createSignalHref = `/${lang}/dho/${spaceSlug}/coherence/create-signal`;
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
      if (!signal.slug?.trim()) return;
      await patchTask({
        slug: signal.slug,
        ...patch,
      });
      await refresh();
    },
    [patchTask, refresh],
  );

  const visibleSignals = filteredSignals;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {toolbarLeft}
        <div className="relative min-w-[12rem] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t('searchSignals')}
            onChange={(event) => onUpdateSearch(event.target.value)}
            defaultValue={searchTerm}
          />
        </div>
        <Tabs
          value={viewMode}
          onValueChange={(value) => setViewMode(value as SignalViewMode)}
        >
          <TabsList>
            <TabsTrigger value="board">{t('signalViewBoard')}</TabsTrigger>
            <TabsTrigger value="swimlane">
              {t('signalViewSwimlane')}
            </TabsTrigger>
            <TabsTrigger value="list">{t('signalViewList')}</TabsTrigger>
            <TabsTrigger value="grid">{t('signalViewGrid')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={hideArchived}
            onCheckedChange={(checked) => setHideArchived(checked === true)}
          />
          {t('hideArchived')}
        </label>
        {canMutate ? (
          <Button asChild colorVariant="accent" className="ml-auto">
            <Link href={createSignalHref}>
              <PlusIcon />
              {t('newSignal')}
            </Link>
          </Button>
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
          signals={visibleSignals}
          workflow={resolvedWorkflow}
          onSignalClick={onSignalClick}
          onMoveStatus={(signal, progressStatus) =>
            patchAndRefresh(signal, { progressStatus })
          }
        />
      ) : viewMode === 'swimlane' ? (
        <SignalSwimlaneView
          signals={visibleSignals}
          workflow={resolvedWorkflow}
          onSignalClick={onSignalClick}
          onMoveBoard={(signal, board) => patchAndRefresh(signal, { board })}
        />
      ) : viewMode === 'list' ? (
        <SignalListView
          signals={visibleSignals}
          workflow={resolvedWorkflow}
          onSignalClick={onSignalClick}
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
