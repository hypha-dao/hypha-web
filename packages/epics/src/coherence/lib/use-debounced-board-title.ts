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

/**
 * Keep the title filter input instant while writing `title=` to the URL
 * after a short pause. External URL changes (shared links, Clear) still
 * overwrite the local value.
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
  const lastCommittedRef = React.useRef(committedTitle);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const commitTitle = useDebouncedCallback((value: string) => {
    const nextTitle = value || undefined;
    lastCommittedRef.current = nextTitle ?? '';
    const current = filtersRef.current;
    if ((current.title ?? '') === (nextTitle ?? '')) return;
    onChangeRef.current({ ...current, title: nextTitle });
  }, delayMs);

  React.useEffect(() => {
    return () => {
      commitTitle.flush();
    };
  }, [commitTitle]);

  React.useEffect(() => {
    if (committedTitle === lastCommittedRef.current) return;
    lastCommittedRef.current = committedTitle;
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
    lastCommittedRef.current = '';
    setTitleInput('');
  }, [commitTitle]);

  return { titleInput, onTitleChange, resetTitle };
}
