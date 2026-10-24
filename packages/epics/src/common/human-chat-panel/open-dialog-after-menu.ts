/** Open a dialog after the menu unmounts so Radix can restore pointer events. */
export function openDialogAfterMenu(open: () => void) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(open);
    });
    return;
  }
  open();
}
