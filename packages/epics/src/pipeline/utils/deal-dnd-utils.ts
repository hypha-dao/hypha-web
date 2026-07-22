export const DEAL_DRAG_MIME = 'application/x-hypha-deal-id';

export function setDealDragData(
  event: React.DragEvent<HTMLElement>,
  dealId: number,
): void {
  const id = String(dealId);
  event.dataTransfer.setData(DEAL_DRAG_MIME, id);
  event.dataTransfer.setData('text/plain', id);
  event.dataTransfer.effectAllowed = 'move';
}

export function getDealDragId(
  event: React.DragEvent<HTMLElement>,
  fallbackId?: number | null,
): number | null {
  const fromMime = event.dataTransfer.getData(DEAL_DRAG_MIME).trim();
  if (fromMime) {
    const n = Number.parseInt(fromMime, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }
  const fromPlain = event.dataTransfer.getData('text/plain').trim();
  if (fromPlain) {
    const n = Number.parseInt(fromPlain, 10);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return fallbackId ?? null;
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
