import type { WheelEvent } from 'react';

/** Scroll the nearest scrollable ancestor, or the window. */
export function scrollScrollableAncestorOrWindow(
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
 * When a kanban/swimlane column has no internal overflow, wheel events should
 * scroll the page instead of being swallowed by the column shell.
 */
export function handleSignalColumnWheel(event: WheelEvent<HTMLElement>): void {
  const column = event.currentTarget;
  if (column.scrollHeight > column.clientHeight + 1) {
    return;
  }

  event.preventDefault();
  scrollScrollableAncestorOrWindow(column, event.deltaY);
}

/** Forward wheel from column chrome (header/padding) to the page scroll. */
export function handleSignalColumnShellWheel(
  event: WheelEvent<HTMLElement>,
): void {
  const shell = event.currentTarget;
  const stack = shell.querySelector<HTMLElement>('[data-signal-card-stack]');

  if (stack?.contains(event.target as Node)) {
    if (stack.scrollHeight > stack.clientHeight + 1) {
      return;
    }
    return;
  }

  event.preventDefault();
  scrollScrollableAncestorOrWindow(shell, event.deltaY);
}
