import type { WheelEvent } from 'react';

/** Scroll the nearest scrollable ancestor, or the window. */
function scrollScrollableAncestorOrWindow(
  from: HTMLElement,
  deltaY: number,
): void {
  let node: HTMLElement | null = from.parentElement;

  while (node) {
    const { overflowY } = getComputedStyle(node);
    const scrollable =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1;

    if (scrollable) {
      node.scrollTop += deltaY;
      return;
    }

    if (node === document.documentElement || node === document.body) {
      break;
    }

    node = node.parentElement;
  }

  window.scrollBy({ top: deltaY, behavior: 'auto' });
}

/**
 * When a pipeline column has no internal overflow, wheel events should scroll
 * the page instead of being swallowed by the column shell.
 */
export function handlePipelineColumnWheel(
  event: WheelEvent<HTMLElement>,
): void {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    return;
  }

  const column = event.currentTarget;
  if (column.scrollHeight > column.clientHeight + 1) {
    return;
  }

  event.preventDefault();
  scrollScrollableAncestorOrWindow(column, event.deltaY);
}

/** Forward wheel from column chrome (header/padding) to the page scroll. */
export function handlePipelineColumnShellWheel(
  event: WheelEvent<HTMLElement>,
): void {
  const shell = event.currentTarget;
  const stack = shell.querySelector<HTMLElement>('[data-pipeline-card-stack]');

  if (stack?.contains(event.target as Node)) {
    return;
  }

  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    return;
  }

  event.preventDefault();
  scrollScrollableAncestorOrWindow(shell, event.deltaY);
}
