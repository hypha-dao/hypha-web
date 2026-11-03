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

function collapseSignalText(value: string): string {
  return (
    value
      // `[^<>]` cannot cross another delimiter, so a long run of '<' is linear.
      .replace(/<[^<>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * The first text row in a signal room is the description seed. Later chat
 * keeps its Matrix sender. Content is compared after stripping tags so a
 * rich-text description still matches the seeded body.
 */
export function isSignalDescriptionAnchorMessage({
  isFirstChatTextMessage,
  messageContent,
  signalDescription,
}: {
  isFirstChatTextMessage: boolean;
  messageContent?: string | null;
  signalDescription?: string | null;
}): boolean {
  if (!isFirstChatTextMessage) return false;
  const message = collapseSignalText(messageContent ?? '');
  if (!message) return false;
  const description = collapseSignalText(signalDescription ?? '');
  if (!description) return true;
  return message === description;
}

/**
 * Reattribute the description seed to the stored creator. Assignees keep
 * seeing the author, not "You". When the viewer is the creator, still
 * override — a non-creator editor may have reseeded the Matrix message.
 */
export function applySignalCreatorToChatAuthor({
  isDescriptionAnchor,
  viewerPersonId,
  creatorId,
  creatorName,
  viewerName,
}: {
  isDescriptionAnchor: boolean;
  viewerPersonId?: number | null;
  creatorId?: number | null;
  creatorName?: string | null;
  viewerName?: string | null;
}): { role: 'user' | 'member'; senderName?: string } | null {
  if (!isDescriptionAnchor || !isPersistedPersonId(creatorId)) return null;
  const senderName = resolveSignalCreatorDisplayName({
    viewerPersonId,
    creatorId,
    viewerName,
    creatorName,
  });
  if (!creatorName?.trim() && senderName === 'Member') return null;
  if (isPersistedPersonId(viewerPersonId) && viewerPersonId === creatorId) {
    return {
      role: 'user',
      senderName,
    };
  }
  return {
    role: 'member',
    senderName,
  };
}
