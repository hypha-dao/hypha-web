'use client';

import { cn } from '@hypha-platform/ui-utils';

type AiPanelSuggestionsProps = {
  suggestions: readonly string[];
  onSelect: (suggestion: string) => void;
};

export function AiPanelSuggestions({
  suggestions,
  onSelect,
}: AiPanelSuggestionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className={cn(
            'rounded-xl border border-border bg-secondary px-3 py-2.5 text-left text-xs text-muted-foreground',
            'transition-all duration-200 hover:border-primary/40 hover:bg-muted hover:text-foreground',
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
