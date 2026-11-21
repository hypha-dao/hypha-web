'use client';

import { useEffect, useRef } from 'react';
import { useMe } from '@hypha-platform/core/client';
import { isMemberOrientation, useHumanChatPanel } from '@hypha-platform/epics';

/**
 * Members who open a signal from their home land on the detail with the
 * discussion panel already open. Everyone else keeps the panel closed.
 */
export function OpenMemberDiscussion({
  enabled,
  spaceSlug,
  slug,
  title,
  description,
  roomId,
}: {
  enabled: boolean;
  spaceSlug: string;
  slug: string;
  title: string;
  description: string | null;
  roomId: string | null;
}) {
  const { person, isLoading } = useMe();
  const { openCoherenceChat } = useHumanChatPanel();
  const opened = useRef(false);

  useEffect(() => {
    if (!enabled || isLoading) return;
    if (!isMemberOrientation(person?.primaryOrientation)) return;
    if (opened.current) return;
    opened.current = true;
    openCoherenceChat(roomId, title, slug, description, spaceSlug);
  }, [
    description,
    enabled,
    isLoading,
    openCoherenceChat,
    person?.primaryOrientation,
    roomId,
    slug,
    spaceSlug,
    title,
  ]);

  return null;
}
