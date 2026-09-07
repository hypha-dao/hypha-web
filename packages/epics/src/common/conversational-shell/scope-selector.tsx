'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Lock, LockOpen, Sparkles } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';

import type { ScopeCandidate, ScopeState } from './types';

export interface ScopeSelectorProps {
  candidates: ScopeCandidate[];
  activeSpaceSlug?: string;
  locked: boolean;
  /** What last set the scope — shows an "auto" hint when the model did. */
  source?: ScopeState['source'];
  /** `null` → clear the manual pin (auto: seed / model). */
  onSelect: (slug: string | null) => void;
  onToggleLock: (locked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** "ger-test-video-032" → "Ger test video 032". */
export function humaniseSlug(slug: string): string {
  const spaced = slug.replace(/[-_]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : slug;
}

function labelFor(
  slug: string | undefined,
  candidates: ScopeCandidate[],
): string {
  if (!slug) return 'Choose a context';
  const hit = candidates.find((c) => c.slug === slug);
  return hit?.title?.trim() || humaniseSlug(slug);
}

/**
 * Conversational-scope control (#2486 M7): which space the conversation targets,
 * plus a lock toggle. Generic — the host supplies `candidates`.
 */
export function ScopeSelector({
  candidates,
  activeSpaceSlug,
  locked,
  source,
  onSelect,
  onToggleLock,
  disabled = false,
  className,
}: ScopeSelectorProps) {
  const seen = new Set<string>();
  const list = candidates.filter((c) => {
    if (!c.slug || seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });

  const activeLabel = labelFor(activeSpaceSlug, list);
  const autoActive =
    source === 'seed' || source === 'model' || source === 'none';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn('max-w-[13rem] gap-1.5', className)}
          title={
            activeSpaceSlug
              ? `Conversation scope: ${activeLabel}${locked ? ' (locked)' : ''}`
              : 'Choose which space this conversation is about'
          }
        >
          {locked ? (
            <Lock className="size-3.5 shrink-0 opacity-70" aria-hidden />
          ) : (
            <Sparkles className="size-3.5 shrink-0 opacity-70" aria-hidden />
          )}
          <span className="truncate">
            {activeSpaceSlug ? (
              <>
                <span className="text-muted-foreground">In:&nbsp;</span>
                {activeLabel}
              </>
            ) : (
              activeLabel
            )}
          </span>
          <ChevronsUpDown
            className="size-3.5 shrink-0 opacity-50"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Conversation scope</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onSelect(null);
          }}
          className="gap-2"
        >
          <Sparkles className="size-3.5 opacity-70" aria-hidden />
          <span className="flex-1">Auto (recent / follow the chat)</span>
          {autoActive ? <Check className="size-3.5" aria-hidden /> : null}
        </DropdownMenuItem>

        {list.length > 0 ? <DropdownMenuSeparator /> : null}

        {list.map((candidate) => {
          const isActive = candidate.slug === activeSpaceSlug;
          return (
            <DropdownMenuItem
              key={candidate.slug}
              onSelect={(e) => {
                e.preventDefault();
                onSelect(candidate.slug);
              }}
              className="gap-2"
            >
              <span className="flex-1 truncate">
                {candidate.title?.trim() || humaniseSlug(candidate.slug)}
              </span>
              {candidate.source === 'membership' ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  member
                </span>
              ) : null}
              {isActive && !autoActive ? (
                <Check className="size-3.5" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onToggleLock(!locked);
          }}
          className="gap-2"
        >
          {locked ? (
            <LockOpen className="size-3.5 opacity-70" aria-hidden />
          ) : (
            <Lock className="size-3.5 opacity-70" aria-hidden />
          )}
          <span className="flex-1">
            {locked
              ? 'Unlock — let the chat switch spaces'
              : 'Lock to this space'}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
