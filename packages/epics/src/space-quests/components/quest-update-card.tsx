'use client';

import type { QuestUpdateRecord } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { PersonAvatar } from '../../people/components/person-avatar';
import {
  questUpdateDetailEntries,
  type QuestUpdateDetailEntry,
  type QuestUpdateListRow,
} from '../utils/quest-update-detail';
import { QuestSectionMarkdown } from './quest-section-markdown';

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ChangeList({ rows }: { rows: readonly QuestUpdateListRow[] }) {
  return (
    <ul className="space-y-1 text-[13px] leading-relaxed">
      {rows.map((row, index) => {
        const prefix = row.label ? `${row.label} ` : '';
        if (row.kind === 'added') {
          return (
            <li key={`${row.text}-${index}`} className="text-success-11">
              {prefix}+ {row.text}
            </li>
          );
        }
        if (row.kind === 'removed') {
          return (
            <li
              key={`${row.text}-${index}`}
              className="text-neutral-11 line-through"
            >
              {prefix}− {row.text}
            </li>
          );
        }
        return (
          <li key={`${row.before}-${row.after}-${index}`}>
            {prefix ? <span className="text-neutral-11">{prefix}</span> : null}
            <span className="text-neutral-11">{row.before}</span>
            <span className="text-neutral-11"> → </span>
            <span className="text-foreground">{row.after}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ChangeEntry({ entry }: { entry: QuestUpdateDetailEntry }) {
  const t = useTranslations('SpaceQuests');
  if (entry.kind === 'list') {
    return (
      <div className="space-y-1">
        {entry.label ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-11">
            {entry.label}
          </p>
        ) : null}
        <ChangeList rows={entry.rows} />
      </div>
    );
  }
  if (entry.kind === 'short') {
    return (
      <p className="text-[13px] leading-relaxed text-foreground">
        {entry.label ? (
          <span className="mr-1 text-neutral-11">{entry.label}</span>
        ) : null}
        <span className="text-neutral-11">{entry.before}</span>
        <span className="text-neutral-11"> → </span>
        <span>{entry.after}</span>
      </p>
    );
  }
  const changeLabelClass =
    'text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-11';
  return (
    <div className="min-w-0 space-y-1">
      {entry.label ? <p className={changeLabelClass}>{entry.label}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 space-y-1" data-testid="quest-update-before">
          <p className={changeLabelClass}>{t('updates.before')}</p>
          <QuestSectionMarkdown markdown={entry.before} empty="—" />
        </div>
        <div className="min-w-0 space-y-1" data-testid="quest-update-after">
          <p className={changeLabelClass}>{t('updates.after')}</p>
          <QuestSectionMarkdown markdown={entry.after} empty="—" />
        </div>
      </div>
    </div>
  );
}

export function QuestUpdateCard({ update }: { update: QuestUpdateRecord }) {
  const t = useTranslations('SpaceQuests');
  const entries = questUpdateDetailEntries(update.change);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      className="flex items-start gap-2.5 px-3 py-3"
      data-testid="quest-update-card"
    >
      <span data-testid="quest-update-avatar" className="shrink-0">
        <PersonAvatar
          avatarSrc={update.authorAvatarUrl?.trim() || undefined}
          userName={update.authorName}
          size="sm"
          shape="circle"
          showPresence={false}
          personId={update.authorPersonId ?? undefined}
        />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">
            {update.authorName}
          </span>
          {update.viaAgent ? (
            <span className="text-[11px] text-[#4b4bff]">✦ via agent</span>
          ) : null}
          {update.milestoneOrder != null || update.milestoneLabel ? (
            <span className="bg-neutral-3 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {update.milestoneLabel || `M${update.milestoneOrder}`}
            </span>
          ) : null}
          <span className="ml-auto text-[11px] text-neutral-11">
            {formatClock(update.createdAt)}
          </span>
        </div>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[13px] text-foreground">
            {update.text}
          </p>
          {entries.length > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              data-testid="quest-update-change-toggle"
              onClick={() => setOpen((current) => !current)}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-neutral-11 hover:text-foreground"
            >
              {open ? t('updates.hideChanges') : t('updates.showChanges')}
              <ChevronDown
                className={cn(
                  'size-3.5 transition-transform',
                  open && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
        {open && entries.length > 0 ? (
          <div
            id={panelId}
            className="max-h-60 space-y-2 overflow-y-auto border-l border-border pl-2"
            data-testid="quest-update-change"
          >
            {entries.map((entry, index) => (
              <ChangeEntry key={`${entry.kind}-${index}`} entry={entry} />
            ))}
          </div>
        ) : null}
        {update.links.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {update.links.map((link, idx) => (
              <a
                key={`${link.url}-${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-neutral-3"
              >
                {link.label}
                <ArrowUpRight className="size-3" aria-hidden />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
