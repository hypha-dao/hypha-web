'use client';

import type { QuestUpdateRecord } from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import {
  questUpdateDetailEntries,
  questUpdateDetailIsLong,
  type QuestUpdateDetailEntry,
} from '../utils/quest-update-detail';

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ChangeEntry({ entry }: { entry: QuestUpdateDetailEntry }) {
  if (entry.kind === 'short') {
    return <p className="text-[13px] text-foreground">{entry.line}</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-11">
        {entry.label}
      </p>
      <p className="text-[11px] text-neutral-11">Before</p>
      <p className="whitespace-pre-wrap text-[13px] text-foreground">
        {entry.before}
      </p>
      <p className="text-[11px] text-neutral-11">After</p>
      <p className="whitespace-pre-wrap text-[13px] text-foreground">
        {entry.after}
      </p>
    </div>
  );
}

function ChangeDetail({ entries }: { entries: QuestUpdateDetailEntry[] }) {
  const long = questUpdateDetailIsLong(entries);
  const [expanded, setExpanded] = useState(false);
  const visible = !long || expanded ? entries : entries.slice(0, 1);
  const preview =
    long && !expanded && visible[0]?.kind === 'text'
      ? [
          {
            ...visible[0],
            before:
              visible[0].before.length > 120
                ? `${visible[0].before.slice(0, 120)}…`
                : visible[0].before,
            after:
              visible[0].after.length > 120
                ? `${visible[0].after.slice(0, 120)}…`
                : visible[0].after,
          },
        ]
      : visible;

  return (
    <div className="space-y-2 pt-1" data-testid="quest-update-change">
      {preview.map((entry, index) => (
        <ChangeEntry key={`${entry.label}-${index}`} entry={entry} />
      ))}
      {long ? (
        <button
          type="button"
          className="text-[11px] font-semibold text-foreground underline-offset-2 hover:underline"
          data-testid="quest-update-change-toggle"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Hide change' : 'Show change'}
        </button>
      ) : null}
    </div>
  );
}

export function QuestUpdateCard({ update }: { update: QuestUpdateRecord }) {
  const entries = questUpdateDetailEntries(update.change);
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
        <p className="text-[13px] text-foreground">{update.text}</p>
        {entries.length > 0 ? <ChangeDetail entries={entries} /> : null}
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
