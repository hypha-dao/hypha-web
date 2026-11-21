'use client';

import { cn } from '@hypha-platform/ui-utils';

export type AiPanelSuggestionItem = {
  id: string;
  /** Full prompt sent to the chat when selected. */
  prompt: string;
  /** Short label for compact tag chips above the composer. */
  tagLabel: string;
};

type AiPanelSuggestionsProps = {
  items: readonly AiPanelSuggestionItem[];
  onSelect: (prompt: string) => void;
  variant?: 'cards' | 'tags';
  /** Home page: chips wrap above the composer. The panel keeps a single scrolling row. */
  wrap?: boolean;
};

export function AiPanelSuggestions({
  items,
  onSelect,
  variant = 'cards',
  wrap = false,
}: AiPanelSuggestionsProps) {
  if (items.length === 0) return null;

  if (variant === 'tags') {
    return (
      <div
        className={cn(
          'bg-transparent',
          wrap ? 'px-4 pt-2 pb-2' : 'px-6 pt-2 pb-1',
        )}
        data-testid="ai-panel-suggestion-tags"
      >
        <div
          className={cn(
            wrap
              ? 'flex flex-wrap gap-2'
              : 'narrow-scrollbar flex gap-1.5 overflow-x-auto',
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.prompt}
              onClick={() => onSelect(item.prompt)}
              className={cn(
                'shrink-0 rounded-none border bg-transparent leading-none text-foreground',
                wrap
                  ? 'border-border px-3 py-2 text-2'
                  : 'border-foreground px-3 py-1 text-[11px] font-medium',
              )}
            >
              {item.tagLabel}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-2 pt-2"
      data-testid="ai-panel-suggestion-cards"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.prompt)}
          className={cn(
            'craft-card-interactive px-3 py-2.5 text-left text-xs text-muted-foreground',
            'dark:bg-background-5 hover:text-foreground',
          )}
        >
          {item.prompt}
        </button>
      ))}
    </div>
  );
}
