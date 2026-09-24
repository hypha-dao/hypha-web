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
};

export function AiPanelSuggestions({
  items,
  onSelect,
  variant = 'cards',
}: AiPanelSuggestionsProps) {
  if (items.length === 0) return null;

  if (variant === 'tags') {
    return (
      <div
        className="bg-transparent px-3 py-2"
        data-testid="ai-panel-suggestion-tags"
      >
        <div className="narrow-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.prompt}
              onClick={() => onSelect(item.prompt)}
              className={cn(
                'shrink-0 rounded-none border border-border/70 bg-transparent px-2.5 py-1 text-[11px] font-medium leading-tight text-muted-foreground',
                'transition-colors duration-200 hover:border-foreground/30 hover:text-foreground',
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
            'rounded-none border border-border/70 bg-transparent px-3 py-2.5 text-left text-xs text-muted-foreground',
            'transition-colors duration-200 hover:border-foreground/30 hover:text-foreground',
          )}
        >
          {item.prompt}
        </button>
      ))}
    </div>
  );
}
