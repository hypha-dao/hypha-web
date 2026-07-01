'use client';

import React from 'react';
import slugify from 'slugify';
import { useTranslations } from 'next-intl';
import {
  DEFAULT_SIGNAL_WORKFLOW,
  type SignalBoardDefinition,
  type SignalStatusCategory,
  type SignalStatusDefinition,
  type SignalWorkflowConfig,
  sanitizeSignalWorkflowConfig,
  useSignalWorkflow,
  useUpdateSignalWorkflow,
} from '@hypha-platform/core/client';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Archive, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

const WORKFLOW_COLORS = [
  'neutral',
  'accent',
  'warn',
  'success',
  'error',
] as const;

const STATUS_CATEGORIES: SignalStatusCategory[] = [
  'backlog',
  'active',
  'done',
  'cancelled',
];

function reindexPositions<T extends { position: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, position: index }));
}

function uniqueSlug(base: string, existing: Set<string>): string {
  const normalized =
    slugify(base, { lower: true, strict: true, replacement: '_' })
      .replace(/-/g, '_')
      .slice(0, 64) || 'item';
  if (!existing.has(normalized)) return normalized;
  let counter = 2;
  while (existing.has(`${normalized}_${counter}`)) {
    counter += 1;
  }
  return `${normalized}_${counter}`.slice(0, 64);
}

function workflowFingerprint(config: SignalWorkflowConfig): string {
  return JSON.stringify(config);
}

type SignalWorkflowSettingsProps = {
  spaceSlug: string;
};

export type SignalWorkflowSettingsHandle = {
  saveIfDirty: () => Promise<void>;
};

export const SignalWorkflowSettings = React.forwardRef<
  SignalWorkflowSettingsHandle,
  SignalWorkflowSettingsProps
>(function SignalWorkflowSettings({ spaceSlug }, ref) {
  const t = useTranslations('CoherenceTab');
  const { workflow, isLoading, refresh } = useSignalWorkflow(spaceSlug);
  const { updateWorkflow } = useUpdateSignalWorkflow(spaceSlug);
  const [draft, setDraft] = React.useState<SignalWorkflowConfig>(
    structuredClone(DEFAULT_SIGNAL_WORKFLOW),
  );
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const syncedWorkflowFingerprint = React.useRef<string | null>(null);
  const syncedSpaceSlug = React.useRef(spaceSlug);

  React.useEffect(() => {
    if (syncedSpaceSlug.current !== spaceSlug) {
      syncedSpaceSlug.current = spaceSlug;
      syncedWorkflowFingerprint.current = null;
    }
  }, [spaceSlug]);

  React.useEffect(() => {
    if (!workflow) return;
    const fingerprint = workflowFingerprint(workflow);
    if (syncedWorkflowFingerprint.current === fingerprint) return;
    syncedWorkflowFingerprint.current = fingerprint;
    setDraft(structuredClone(workflow));
  }, [workflow]);

  const moveItem = React.useCallback(
    <T extends SignalStatusDefinition | SignalBoardDefinition>(
      key: 'statuses' | 'boards',
      index: number,
      direction: -1 | 1,
    ) => {
      setDraft((current) => {
        const items = [...current[key]];
        const target = index + direction;
        if (target < 0 || target >= items.length) return current;
        [items[index], items[target]] = [items[target]!, items[index]!];
        return { ...current, [key]: reindexPositions(items) };
      });
    },
    [],
  );

  const updateStatus = React.useCallback(
    (index: number, patch: Partial<SignalStatusDefinition>) => {
      setDraft((current) => {
        const statuses = [...current.statuses];
        const existing = statuses[index];
        if (!existing) return current;
        statuses[index] = { ...existing, ...patch };
        return { ...current, statuses };
      });
    },
    [],
  );

  const updateBoard = React.useCallback(
    (index: number, patch: Partial<SignalBoardDefinition>) => {
      setDraft((current) => {
        const boards = [...current.boards];
        const existing = boards[index];
        if (!existing) return current;
        boards[index] = { ...existing, ...patch };
        return { ...current, boards };
      });
    },
    [],
  );

  const addStatus = React.useCallback(() => {
    setDraft((current) => {
      const slugs = new Set(current.statuses.map((item) => item.slug));
      const slug = uniqueSlug('new_status', slugs);
      return {
        ...current,
        statuses: reindexPositions([
          ...current.statuses,
          {
            slug,
            name: t('signalWorkflowNewStatus'),
            color: 'neutral',
            category: 'backlog',
            position: current.statuses.length,
          },
        ]),
      };
    });
  }, [t]);

  const addBoard = React.useCallback(() => {
    setDraft((current) => {
      const slugs = new Set(current.boards.map((item) => item.slug));
      const slug = uniqueSlug('new_board', slugs);
      return {
        ...current,
        boards: reindexPositions([
          ...current.boards,
          {
            slug,
            name: t('signalWorkflowNewBoard'),
            color: 'neutral',
            position: current.boards.length,
          },
        ]),
      };
    });
  }, [t]);

  const removeStatus = React.useCallback((index: number) => {
    setDraft((current) => {
      if (current.statuses.length <= 1) return current;
      const statuses = current.statuses.filter((_, i) => i !== index);
      return { ...current, statuses: reindexPositions(statuses) };
    });
  }, []);

  const removeBoard = React.useCallback((index: number) => {
    setDraft((current) => {
      if (current.boards.length <= 1) return current;
      const boards = current.boards.filter((_, i) => i !== index);
      return { ...current, boards: reindexPositions(boards) };
    });
  }, []);

  const handleSave = React.useCallback(async () => {
    setSaveError(null);
    const prepared = sanitizeSignalWorkflowConfig(draft);
    try {
      await updateWorkflow(prepared);
      setDraft(prepared);
      syncedWorkflowFingerprint.current = workflowFingerprint(prepared);
      await refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('signalWorkflowSaveFailed');
      setSaveError(message);
      throw error;
    }
  }, [draft, refresh, t, updateWorkflow]);

  React.useImperativeHandle(
    ref,
    () => ({
      saveIfDirty: async () => {
        if (!workflow) return;
        const prepared = sanitizeSignalWorkflowConfig(draft);
        if (JSON.stringify(prepared) === JSON.stringify(workflow)) return;
        await handleSave();
      },
    }),
    [draft, handleSave, workflow],
  );

  if (isLoading && !workflow) {
    return (
      <div className="text-1 text-neutral-11">{t('signalWorkflowLoading')}</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-3 font-medium text-foreground">
          {t('signalWorkflowSettingsTitle')}
        </h3>
        <p className="mt-1 text-1 text-neutral-11">
          {t('signalWorkflowSettingsDescription')}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-foreground">
              {t('signalWorkflowStatuses')}
            </Label>
            <p className="text-1 text-neutral-11">
              {t('signalFormStatusHint')}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addStatus}>
            <Plus className="size-4" />
            {t('signalWorkflowAddStatus')}
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {draft.statuses.map((status, index) => (
            <WorkflowRow
              key={status.slug}
              index={index}
              total={draft.statuses.length}
              onMoveUp={() => moveItem('statuses', index, -1)}
              onMoveDown={() => moveItem('statuses', index, 1)}
              onRemove={() => removeStatus(index)}
              disableRemove={draft.statuses.length <= 1}
            >
              <Input
                value={status.name}
                onChange={(event) =>
                  updateStatus(index, { name: event.target.value })
                }
                placeholder={t('signalWorkflowNamePlaceholder')}
                aria-label={t('signalFormStatus')}
              />
              <Select
                value={status.color}
                onValueChange={(value) => updateStatus(index, { color: value })}
              >
                <SelectTrigger aria-label={t('signalWorkflowColor')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_COLORS.map((color) => (
                    <SelectItem key={color} value={color}>
                      {t(`signalWorkflowColors.${color}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status.category}
                onValueChange={(value) =>
                  updateStatus(index, {
                    category: value as SignalStatusCategory,
                  })
                }
              >
                <SelectTrigger aria-label={t('signalWorkflowCategory')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`signalWorkflowCategories.${category}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkflowRow>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-foreground">
              {t('signalWorkflowBoards')}
            </Label>
            <p className="text-1 text-neutral-11">{t('signalFormBoardHint')}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addBoard}>
            <Plus className="size-4" />
            {t('signalWorkflowAddBoard')}
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {draft.boards.map((board, index) => (
            <WorkflowRow
              key={board.slug}
              index={index}
              total={draft.boards.length}
              onMoveUp={() => moveItem('boards', index, -1)}
              onMoveDown={() => moveItem('boards', index, 1)}
              onRemove={() => removeBoard(index)}
              disableRemove={draft.boards.length <= 1}
              trailing={
                <Button
                  type="button"
                  variant={board.archived ? 'default' : 'outline'}
                  size="icon"
                  className="shrink-0"
                  aria-label={t('signalWorkflowArchiveBoard')}
                  aria-pressed={board.archived ?? false}
                  onClick={() =>
                    updateBoard(index, { archived: !board.archived })
                  }
                >
                  <Archive className="size-4" />
                </Button>
              }
            >
              <Input
                value={board.name}
                onChange={(event) =>
                  updateBoard(index, { name: event.target.value })
                }
                placeholder={t('signalWorkflowNamePlaceholder')}
                aria-label={t('signalFormBoard')}
                className={cn(board.archived && 'opacity-60')}
              />
              <Select
                value={board.color}
                onValueChange={(value) => updateBoard(index, { color: value })}
              >
                <SelectTrigger aria-label={t('signalWorkflowColor')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_COLORS.map((color) => (
                    <SelectItem key={color} value={color}>
                      {t(`signalWorkflowColors.${color}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkflowRow>
          ))}
        </div>
      </div>

      {saveError ? <p className="text-1 text-error-11">{saveError}</p> : null}
    </div>
  );
});

type WorkflowRowProps = {
  children: React.ReactNode;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  disableRemove: boolean;
  trailing?: React.ReactNode;
};

function WorkflowRow({
  children,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  disableRemove,
  trailing,
}: WorkflowRowProps) {
  const t = useTranslations('CoherenceTab');

  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{children}</div>
      <div className="flex items-center justify-end gap-1">
        {trailing}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('signalWorkflowMoveUp')}
          disabled={index === 0}
          onClick={onMoveUp}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('signalWorkflowMoveDown')}
          disabled={index >= total - 1}
          onClick={onMoveDown}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('signalWorkflowRemove')}
          disabled={disableRemove}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
