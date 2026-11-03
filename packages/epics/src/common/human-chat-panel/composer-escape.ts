/** Escape should close a composer overlay, not the mobile DM Sheet. */
export function composerOverlayConsumesEscape(input: {
  emojiPickerOpen: boolean;
  colonAutocompleteOpen: boolean;
}): boolean {
  return input.emojiPickerOpen || input.colonAutocompleteOpen;
}

export const COMPOSER_OVERLAY_ESCAPE_SELECTOR =
  '[data-hypha-emoji-picker], [data-hypha-colon-autocomplete]';

/** Chat Sidebar `shouldPreventEscapeDismiss` — overlays live outside the Sheet. */
export function shouldPreventChatSheetEscapeDismiss(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector(COMPOSER_OVERLAY_ESCAPE_SELECTOR));
}
