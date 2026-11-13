/**
 * Enter confirms a composer message. IME composition (including keyCode 229)
 * must not submit, or a candidate confirmation sends the unfinished text.
 */
export function shouldSubmitComposerOnEnter(event: {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
}): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  return event.key === 'Enter';
}
