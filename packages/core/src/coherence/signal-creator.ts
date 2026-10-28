/**
 * Signal creator is the author who raised the signal. Assignees and the
 * current viewer are not substitutes — a signal Gerardo created and assigned
 * to Alex must keep Gerardo as creator.
 */

export function isPersistedPersonId(
  value: number | null | undefined,
): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Form field for `creatorId`. Create attributes the signed-in viewer.
 * Edit keeps the stored author and never copies the viewer or an assignee.
 */
export function resolveSignalFormCreatorId({
  mode,
  storedCreatorId,
  viewerId,
}: {
  mode: 'create' | 'edit';
  storedCreatorId?: number | null;
  viewerId?: number | null;
}): number | null {
  const stored = isPersistedPersonId(storedCreatorId) ? storedCreatorId : null;
  const viewer = isPersistedPersonId(viewerId) ? viewerId : null;
  if (mode === 'edit') return stored;
  return viewer ?? stored;
}

/**
 * User-created signals are always attributed to the authenticated actor.
 * A client-supplied creatorId (including an assignee) is ignored.
 */
export function creatorIdForAuthenticatedCreate(
  actorPersonId: number,
  _requestedCreatorId?: number | null,
): number {
  return actorPersonId;
}

/** Drop `creatorId` so update writes cannot reattribute a signal. */
export function omitCreatorId<T extends object>(
  fields: T,
): Omit<T, 'creatorId'> {
  const { creatorId: _creatorId, ...rest } = fields as T & {
    creatorId?: unknown;
  };
  return rest;
}

/**
 * Person shown in the creator slot. Assignees are ignored so an assigned
 * viewer is not labeled as the author (including the "You" fallback).
 */
export function resolveSignalCreatorDisplayName({
  viewerPersonId,
  creatorId,
  viewerName,
  creatorName,
  creatorKind = 'person',
  nonPersonLabel,
}: {
  viewerPersonId?: number | null;
  creatorId?: number | null;
  viewerName?: string | null;
  creatorName?: string | null;
  creatorKind?: 'person' | 'aiRole' | 'backgroundJob' | 'relay';
  nonPersonLabel?: string | null;
}): string {
  if (creatorKind !== 'person') {
    return nonPersonLabel?.trim() || 'AI Agent';
  }
  if (
    isPersistedPersonId(viewerPersonId) &&
    isPersistedPersonId(creatorId) &&
    viewerPersonId === creatorId
  ) {
    return viewerName?.trim() || 'You';
  }
  return creatorName?.trim() || 'Member';
}
