'use client';

import React from 'react';
import { useDebouncedCallback } from 'use-debounce';

export const SIGNAL_FEED_TITLE_DEBOUNCE_MS = 300;

type UseDebouncedFeedTitleArgs = {
  /** Trimmed title query already committed (the URL value). */
  committed: string;
  onCommit: (value: string) => void;
  delayMs?: number;
};

function normalizeTitleQuery(value: string): string {
  return value.trim();
}

/**
 * Feed title search: the field updates immediately, the committed query
 * (URL) updates after a short pause. Back/forward and a shared link replace
 * the field only when this hook did not write that value.
 */
export function useDebouncedFeedTitle({
  committed,
  onCommit,
  delayMs = SIGNAL_FEED_TITLE_DEBOUNCE_MS,
}: UseDebouncedFeedTitleArgs) {
  const [titleInput, setTitleInput] = React.useState(committed);
  const lastWroteRef = React.useRef(normalizeTitleQuery(committed));
  const onCommitRef = React.useRef(onCommit);
  onCommitRef.current = onCommit;

  const commitTitle = useDebouncedCallback((value: string) => {
    const normalized = normalizeTitleQuery(value);
    lastWroteRef.current = normalized;
    onCommitRef.current(normalized);
  }, delayMs);

  React.useEffect(() => {
    return () => {
      commitTitle.cancel();
    };
  }, [commitTitle]);

  React.useEffect(() => {
    const incoming = normalizeTitleQuery(committed);
    if (incoming === lastWroteRef.current) return;
    lastWroteRef.current = incoming;
    setTitleInput(committed);
    commitTitle.cancel();
  }, [committed, commitTitle]);

  const onTitleChange = React.useCallback(
    (value: string) => {
      setTitleInput(value);
      commitTitle(value);
    },
    [commitTitle],
  );

  return { titleInput, onTitleChange };
}
