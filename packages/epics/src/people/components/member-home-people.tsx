'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  findNamedDirectRoomId,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
} from '@hypha-platform/core/client';

import { useGlobalCallDock } from '../../common/global-call-dock-context';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { readJoinedPeopleRooms } from './member-home-closest';

type HomePerson = {
  id: number;
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  sharedSpaceCount?: number;
};

export type MemberHomeOpenChat = (person: HomePerson) => Promise<boolean>;

type MemberHomePeopleProps = {
  people: HomePerson[];
  chatSpaceSlug: string | null;
  fallbackName: string;
  extraPersonIds?: number[];
  onOpenChatReady?: (openChat: MemberHomeOpenChat) => void;
  onOpenCallReady?: (openCall: MemberHomeOpenChat) => void;
  onOpenVideoReady?: (openVideo: MemberHomeOpenChat) => void;
};

function labelOf(person: HomePerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

/** Keeps Matrix ready for the connections grid and opens that room in the comms panel. */
export function MemberHomePeople({
  people,
  chatSpaceSlug,
  fallbackName,
  extraPersonIds,
  onOpenChatReady,
  onOpenCallReady,
  onOpenVideoReady,
}: MemberHomePeopleProps) {
  const t = useTranslations('MemberHome');
  const { openCoherenceChat } = useHumanChatPanel();
  const { startAudioForRoom, startVideoForRoom } = useGlobalCallDock();
  const { jwt } = useJwt();
  const matrix = useMatrix();
  const [notice, setNotice] = useState<string | null>(null);
  const openPersonChatRef = useRef<MemberHomeOpenChat>(async () => false);
  const openPersonCallRef = useRef<MemberHomeOpenChat>(async () => false);
  const openPersonVideoRef = useRef<MemberHomeOpenChat>(async () => false);

  const personIds = useMemo(() => {
    const ids = new Set<number>(extraPersonIds ?? []);
    for (const person of people) ids.add(person.id);
    return [...ids];
  }, [extraPersonIds, people]);
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
    personIds,
  });
  async function openRoom(title: string, ids: number[]) {
    if (!matrix.isAuthenticated || !matrix.client) return null;
    const { roomId } = await matrix.createRoom(title);
    for (const id of ids) {
      const mxid = personIdToMatrixUserId[id];
      if (!mxid) continue;
      await matrix.client.invite(roomId, mxid).catch(() => undefined);
    }
    return roomId;
  }

  function showRoom(roomId: string | null, title: string) {
    openCoherenceChat(roomId, title, '');
  }

  async function resolvePersonRoom(person: HomePerson, title: string) {
    showRoom(null, title);
    const mxid = personIdToMatrixUserId[person.id];
    const client = matrix.client;
    const selfId = client?.getUserId() ?? '';
    if (!matrix.isAuthenticated || !client) {
      setNotice(t('matrixUnavailable'));
      return null;
    }
    if (mxid && selfId) {
      const existing = findNamedDirectRoomId(
        readJoinedPeopleRooms(client).named,
        selfId,
        mxid,
        title,
      );
      if (existing) return existing;
    }
    return openRoom(title, [person.id]);
  }

  async function openPersonChat(person: HomePerson): Promise<boolean> {
    setNotice(null);
    const title = labelOf(person, fallbackName);
    try {
      const roomId = await resolvePersonRoom(person, title);
      if (!roomId) {
        setNotice(t('matrixUnavailable'));
        return false;
      }
      showRoom(roomId, title);
      return true;
    } catch {
      setNotice(t('matrixFailed'));
      return false;
    }
  }

  openPersonChatRef.current = openPersonChat;

  useEffect(() => {
    onOpenChatReady?.((person) => openPersonChatRef.current(person));
  }, [onOpenChatReady]);

  async function openPersonMedia(
    person: HomePerson,
    video: boolean,
  ): Promise<boolean> {
    setNotice(null);
    const title = labelOf(person, fallbackName);
    try {
      const roomId = await resolvePersonRoom(person, title);
      if (!roomId) {
        setNotice(t('matrixUnavailable'));
        return false;
      }
      showRoom(roomId, title);
      const start = video ? startVideoForRoom : startAudioForRoom;
      await start(roomId, chatSpaceSlug, undefined, jwt, {
        roomTitle: title,
      });
      return true;
    } catch {
      setNotice(t('callFailed'));
      return false;
    }
  }

  openPersonCallRef.current = (person) => openPersonMedia(person, false);
  openPersonVideoRef.current = (person) => openPersonMedia(person, true);

  useEffect(() => {
    onOpenCallReady?.((person) => openPersonCallRef.current(person));
  }, [onOpenCallReady]);

  useEffect(() => {
    onOpenVideoReady?.((person) => openPersonVideoRef.current(person));
  }, [onOpenVideoReady]);

  if (!notice) return null;

  return (
    <p className="text-2 text-error-11" role="alert">
      {notice}
    </p>
  );
}
