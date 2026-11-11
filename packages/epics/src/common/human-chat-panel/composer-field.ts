/**
 * Shared chat composer frame used by Signals and Quests.
 * The panel only drew a top rule; the field itself is a square box, with
 * padding inside and a line between the text and the tools.
 */
export const CHAT_COMPOSER_ROOT_CLASS =
  'flex w-full min-w-0 flex-shrink-0 flex-col bg-transparent px-3 pt-3';

export const CHAT_COMPOSER_FIELD_CLASS =
  'relative flex min-w-0 flex-col rounded-none border border-border bg-neutral-1 shadow-none transition-colors focus-within:border-foreground';

export const CHAT_COMPOSER_INPUT_SHELL_CLASS =
  'relative isolate min-h-[36px] min-w-0 max-h-[160px] w-full overflow-hidden rounded-none';

export const CHAT_COMPOSER_INPUT_CLASS =
  'box-border bg-transparent px-3 py-2.5';

export const CHAT_COMPOSER_ACTIONS_CLASS =
  'flex min-w-0 flex-col gap-1 border-t border-border px-2 py-2';
