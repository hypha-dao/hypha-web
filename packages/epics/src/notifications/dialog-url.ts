/**
 * URL contract for dialogs that open on top of the current page: `?dialog=<kind>`.
 * Works on every route (no parallel-route slot needed) and keeps all other params.
 * Right panel params (`signal`, `msg`) are a separate surface and are never touched here.
 */
export const DIALOG_PARAM = 'dialog';
export const NOTIFICATION_CENTRE_DIALOG = 'notification-centre';

export function buildDialogHref(
  pathname: string,
  searchParams: { toString(): string } | null | undefined,
  kind: string = NOTIFICATION_CENTRE_DIALOG,
): string {
  const params = new URLSearchParams(searchParams?.toString() ?? '');
  params.set(DIALOG_PARAM, kind);
  return `${pathname}?${params.toString()}`;
}

export function buildDialogCloseHref(
  pathname: string,
  searchParams: { toString(): string } | null | undefined,
): string {
  const params = new URLSearchParams(searchParams?.toString() ?? '');
  params.delete(DIALOG_PARAM);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
