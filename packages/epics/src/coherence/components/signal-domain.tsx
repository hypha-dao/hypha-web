'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  applyPendingCoherenceTaskPatch,
  resolveEffectiveBoard,
  usePatchCoherenceTask,
  useSignalWorkflow,
  type SignalBoardDefinition,
  type SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const DOMAIN_DOT: Record<string, string> = {
  neutral: 'bg-neutral-9',
  accent: 'bg-accent-9',
  warn: 'bg-warning-9',
  warning: 'bg-warning-9',
  success: 'bg-success-9',
  error: 'bg-error-9',
};

/** Solid epic-style dot for a configured domain color. */
export function domainDotClass(color?: string | null): string {
  const key = color?.trim().toLowerCase() ?? 'neutral';
  return DOMAIN_DOT[key] ?? DOMAIN_DOT.neutral!;
}

export function SignalDomainDot({
  color,
  className,
}: {
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-testid="signal-domain-dot"
      data-domain-color={color?.trim().toLowerCase() || 'neutral'}
      className={cn(
        'size-2 shrink-0 rounded-full',
        domainDotClass(color),
        className,
      )}
    />
  );
}

/** Active domains, plus the signal's current domain when it has been archived. */
export function domainBoardChoices(
  workflow: SignalWorkflowConfig,
  current: string | null | undefined,
): SignalBoardDefinition[] {
  const active = workflow.boards
    .filter((board) => !board.archived)
    .sort((a, b) => a.position - b.position);
  const currentSlug = current?.trim();
  if (!currentSlug || active.some((board) => board.slug === currentSlug)) {
    return active;
  }
  const archived = workflow.boards.find((board) => board.slug === currentSlug);
  return archived ? [...active, archived] : active;
}

export function SignalDomainMark({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      data-testid="signal-domain"
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-1 text-muted-foreground',
        className,
      )}
    >
      <SignalDomainDot color={color} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function SignalDomainSelect({
  value,
  boards,
  onChange,
  disabled,
  appearance = 'field',
  className,
  ariaLabel,
}: {
  value: string;
  boards: readonly SignalBoardDefinition[];
  onChange: (slug: string) => void;
  disabled?: boolean;
  appearance?: 'field' | 'quiet';
  className?: string;
  ariaLabel: string;
}) {
  const selected = boards.find((board) => board.slug === value) ?? boards[0];
  if (!selected) return null;

  return (
    <Select value={selected.slug} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        data-testid="signal-domain"
        className={cn(
          'rounded-none',
          appearance === 'quiet'
            ? 'h-7 w-auto gap-1.5 border-transparent bg-transparent px-1.5 text-1 shadow-none hover:bg-foreground/5'
            : 'h-10',
          className,
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <SignalDomainDot color={selected.color} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="rounded-none">
        {boards.map((board) => (
          <SelectItem key={board.slug} value={board.slug}>
            <span className="inline-flex items-center gap-2">
              <SignalDomainDot color={board.color} />
              {board.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Domain on a signal. Members get a dropdown; everyone else sees the colored dot and name.
 */
export function SignalDomainControl({
  spaceSlug,
  signalSlug,
  board,
  editable,
  refresh,
  appearance = 'quiet',
  className,
}: {
  spaceSlug: string;
  signalSlug?: string | null;
  board?: string | null;
  editable: boolean;
  refresh?: () => Promise<unknown>;
  appearance?: 'field' | 'quiet';
  className?: string;
}) {
  const t = useTranslations('CoherenceTab');
  const { workflow } = useSignalWorkflow(spaceSlug);
  const { patchTask } = usePatchCoherenceTask(spaceSlug);
  const [saving, setSaving] = React.useState(false);

  if (!workflow) return null;
  const slug = resolveEffectiveBoard(board, workflow);
  const selected = workflow.boards.find((item) => item.slug === slug) ?? null;
  const choices = domainBoardChoices(workflow, board);
  if (!selected || choices.length === 0) return null;

  const canEdit = editable && Boolean(signalSlug?.trim());
  if (!canEdit) {
    return (
      <SignalDomainMark
        name={selected.name}
        color={selected.color}
        className={className}
      />
    );
  }

  return (
    <div
      className="relative z-10"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <SignalDomainSelect
        value={selected.slug}
        boards={choices}
        disabled={saving}
        appearance={appearance}
        className={className}
        ariaLabel={t('signalFormBoard')}
        onChange={(next) => {
          const signalSlugTrimmed = signalSlug?.trim();
          if (!signalSlugTrimmed || next === selected.slug) return;
          setSaving(true);
          applyPendingCoherenceTaskPatch(spaceSlug, signalSlugTrimmed, {
            board: next,
          });
          void patchTask({ slug: signalSlugTrimmed, board: next })
            .then(async () => {
              await refresh?.();
            })
            .catch(() => {
              applyPendingCoherenceTaskPatch(spaceSlug, signalSlugTrimmed, {
                board: board ?? null,
              });
            })
            .finally(() => setSaving(false));
        }}
      />
    </div>
  );
}
