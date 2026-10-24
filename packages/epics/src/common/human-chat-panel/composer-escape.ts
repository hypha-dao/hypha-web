/** Escape should close a composer overlay, not the mobile DM Sheet. */
export function composerOverlayConsumesEscape(input: {
  emojiPickerOpen: boolean;
  colonAutocompleteOpen: boolean;
}): boolean {
  return input.emojiPickerOpen || input.colonAutocompleteOpen;
}
