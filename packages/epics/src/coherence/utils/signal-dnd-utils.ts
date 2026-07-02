export const SIGNAL_DRAG_MIME = 'application/x-hypha-signal-slug';

export function setSignalDragData(
  event: React.DragEvent<HTMLElement>,
  slug: string,
): void {
  event.dataTransfer.setData(SIGNAL_DRAG_MIME, slug);
  event.dataTransfer.setData('text/plain', slug);
  event.dataTransfer.effectAllowed = 'move';
}

export function getSignalDragSlug(
  event: React.DragEvent<HTMLElement>,
  fallbackSlug?: string | null,
): string | null {
  const fromMime = event.dataTransfer.getData(SIGNAL_DRAG_MIME).trim();
  if (fromMime) return fromMime;
  const fromPlain = event.dataTransfer.getData('text/plain').trim();
  if (fromPlain) return fromPlain;
  return fallbackSlug?.trim() || null;
}

export function isDragLeaveColumn(
  event: React.DragEvent<HTMLElement>,
  columnElement: HTMLElement | null,
): boolean {
  const related = event.relatedTarget;
  if (!columnElement) return true;
  if (!(related instanceof Node)) return true;
  return !columnElement.contains(related);
}

export function handleColumnDragOver(
  event: React.DragEvent<HTMLElement>,
): void {
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = 'move';
}
