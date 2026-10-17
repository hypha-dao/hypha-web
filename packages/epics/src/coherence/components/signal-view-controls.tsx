'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronDown, Cog, Plus } from 'lucide-react';
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { SignalViewMode } from './signal-section';

const VIEW_OPTIONS = [
  { value: 'grid', label: 'signalViewGrid' },
  { value: 'board', label: 'signalViewBoard' },
  { value: 'swimlane', label: 'signalViewSwimlane' },
  { value: 'list', label: 'signalViewList' },
] as const satisfies ReadonlyArray<{
  value: SignalViewMode;
  label:
    | 'signalViewGrid'
    | 'signalViewBoard'
    | 'signalViewSwimlane'
    | 'signalViewList';
}>;

type SignalViewControlsProps = {
  viewMode: SignalViewMode;
  onViewModeChange: (mode: SignalViewMode) => void;
  hideArchived: boolean;
  onHideArchivedChange: (checked: boolean) => void;
  workflowSettingsHref?: string | null;
  createSignalHref?: string | null;
  className?: string;
};

export function SignalViewControls({
  viewMode,
  onViewModeChange,
  hideArchived,
  onHideArchivedChange,
  workflowSettingsHref,
  createSignalHref,
  className,
}: SignalViewControlsProps) {
  const t = useTranslations('CoherenceTab');
  const currentView =
    VIEW_OPTIONS.find((option) => option.value === viewMode) ?? VIEW_OPTIONS[0];

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div className="inline-flex w-max flex-nowrap items-center gap-2">
          {createSignalHref || workflowSettingsHref ? (
            <div className="inline-flex h-10 shrink-0 items-center rounded-none border border-border/70 px-1">
              {createSignalHref ? (
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="sm"
                  className="h-8 min-h-0 w-8 shrink-0 rounded-none p-0 text-muted-foreground hover:text-foreground"
                >
                  <Link
                    href={createSignalHref}
                    scroll={false}
                    aria-label={t('newSignal')}
                    title={t('newSignal')}
                  >
                    <Plus
                      className="craft-icon"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  </Link>
                </Button>
              ) : null}
              {workflowSettingsHref ? (
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="sm"
                  className="h-8 min-h-0 w-8 shrink-0 rounded-none p-0 text-muted-foreground hover:text-foreground"
                >
                  <Link
                    href={workflowSettingsHref}
                    scroll={false}
                    aria-label={t('signalWorkflowSettings')}
                    title={t('signalWorkflowSettings')}
                  >
                    <Cog
                      className="craft-icon"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 shrink-0 items-center gap-2 border border-border/70 bg-background px-3 text-1 uppercase tracking-[0.12em] text-foreground"
              >
                {t(currentView.label)}
                <ChevronDown
                  className="size-3.5 shrink-0"
                  strokeWidth={1.25}
                  aria-hidden
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-40 rounded-none border-border bg-background p-1 text-foreground shadow-none"
            >
              <DropdownMenuRadioGroup
                value={viewMode}
                onValueChange={(value) =>
                  onViewModeChange(value as SignalViewMode)
                }
              >
                {VIEW_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className="rounded-none text-1 uppercase tracking-[0.12em]"
                  >
                    {t(option.label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[14px]">
        <Checkbox
          id="hideArchivedSignalsCheckbox"
          checked={hideArchived}
          onCheckedChange={(checked) => onHideArchivedChange(checked === true)}
        />
        {t('hideArchived')}
      </label>
    </div>
  );
}
