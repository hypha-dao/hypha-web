export function buildScheduledCallJoinPath(
  lang: string,
  spaceSlug: string,
): string {
  const params = new URLSearchParams();
  params.set('joinCall', '1');
  return `/${lang}/dho/${spaceSlug}?${params.toString()}`;
}

export function buildScheduledCalendarEventPath(
  lang: string,
  spaceSlug: string,
  itemId: number,
): string {
  return `/${lang}/dho/${spaceSlug}/calendar?event=${itemId}`;
}

export type MatrixAutoLinkInput = {
  type?: string;
  matrixAutoLink?: boolean;
  meetingUrl?: string | null;
  matrixRoomId?: string | null;
};

export function isMatrixLinkedCall(item: {
  type: string;
  matrixAutoLink?: boolean;
  matrixRoomId?: string | null;
}): boolean {
  return (
    (item.type === 'call' || item.type === 'meeting') &&
    Boolean(item.matrixAutoLink && item.matrixRoomId?.trim())
  );
}
