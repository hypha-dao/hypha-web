'use client';

import React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { SignalBoardFilters } from '@hypha-platform/core/client';

export const SIGNAL_TITLE_FILTER_DEBOUNCE_MS = 300;

type UseDebouncedBoardTitleArgs = {
  filters: SignalBoardFilters;
  onChange: (filters: SignalBoardFilters) => void;
  delayMs?: number;
};

function normalizeTitleForUrl(value: string): string {
  return value.trim();
}

/**
 * Keep the title filter input instant while writing `title=` to the URL
 * after a short pause. The URL stores the trimmed query; the input keeps
 * the raw typed string, including trailing spaces. URL → input sync happens
 * only for the initial prefill and for changes this hook did not write
 * (Clear, back/forward, a shared link).
 */
export function useDebouncedBoardTitle({
  filters,
  onChange,
  delayMs = SIGNAL_TITLE_FILTER_DEBOUNCE_MS,
}: UseDebouncedBoardTitleArgs) {
  const committedTitle = filters.title ?? '';
  const [titleInput, setTitleInput] = React.useState(committedTitle);
  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;
  const lastWroteNormalizedRef = React.useRef(
    normalizeTitleForUrl(committedTitle),
  );
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const commitTitle = useDebouncedCallback((value: string) => {
    const normalized = normalizeTitleForUrl(value);
    lastWroteNormalizedRef.current = normalized;
    const current = filtersRef.current;
    if ((current.title ?? '') === normalized) return;
    onChangeRef.current({
      ...current,
      title: normalized || undefined,
    });
  }, delayMs);

  React.useEffect(() => {
    return () => {
      commitTitle.flush();
    };
  }, [commitTitle]);

  React.useEffect(() => {
    const incoming = normalizeTitleForUrl(committedTitle);
    if (incoming === lastWroteNormalizedRef.current) return;
    lastWroteNormalizedRef.current = incoming;
    setTitleInput(committedTitle);
    commitTitle.cancel();
  }, [committedTitle, commitTitle]);

  const onTitleChange = React.useCallback(
    (value: string) => {
      setTitleInput(value);
      commitTitle(value);
    },
    [commitTitle],
  );

  const resetTitle = React.useCallback(() => {
    commitTitle.cancel();
    lastWroteNormalizedRef.current = '';
    setTitleInput('');
  }, [commitTitle]);

  return { titleInput, onTitleChange, resetTitle };
}
