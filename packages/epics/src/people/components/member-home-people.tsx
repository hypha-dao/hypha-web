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
  /** Space this conversation belongs to, when it was opened from one. */
  spaceSlug?: string | null;
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
  const { personIdToMatrixUserId, isLoading: matrixIdsLoading } =
    useMatrixUserIdsByPersonIds({
      personIds,
    });
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;
  const matrixIdsRef = useRef(personIdToMatrixUserId);
  matrixIdsRef.current = personIdToMatrixUserId;
  const matrixIdsLoadingRef = useRef(matrixIdsLoading);
  matrixIdsLoadingRef.current = matrixIdsLoading;

  function showRoom(
    roomId: string | null,
    title: string,
    spaceSlug?: string | null,
  ) {
    openCoherenceChat(roomId, title, '', null, spaceSlug ?? chatSpaceSlug);
  }

  async function waitForMatrix() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const current = matrixRef.current;
      if (current.isAuthenticated && current.client) return current;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return matrixRef.current;
  }

  async function waitForMatrixUserId(personId: number) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const mxid = matrixIdsRef.current[personId];
      if (mxid) return mxid;
      if (!matrixIdsLoadingRef.current && attempt > 2) return null;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return matrixIdsRef.current[personId] ?? null;
  }

  async function openRoom(
    title: string,
    ids: number[],
    ready: Awaited<ReturnType<typeof waitForMatrix>>,
  ) {
    if (!ready.isAuthenticated || !ready.client) return null;
    const { roomId } = await ready.createRoom(title);
    for (const id of ids) {
      const mxid = await waitForMatrixUserId(id);
      if (!mxid) continue;
      await ready.client.invite(roomId, mxid).catch(() => undefined);
    }
    return roomId;
  }

  async function resolvePersonRoom(person: HomePerson, title: string) {
    const spaceSlug = person.spaceSlug ?? chatSpaceSlug;
    showRoom(null, title, spaceSlug);
    const ready = await waitForMatrix();
    const client = ready.client;
    const selfId = client?.getUserId() ?? '';
    if (!ready.isAuthenticated || !client) {
      setNotice(t('matrixUnavailable'));
      return null;
    }
    const mxid = await waitForMatrixUserId(person.id);
    if (mxid && selfId) {
      const existing = findNamedDirectRoomId(
        readJoinedPeopleRooms(client).named,
        selfId,
        mxid,
        title,
      );
      if (existing) return existing;
    }
    return openRoom(title, [person.id], ready);
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
      showRoom(roomId, title, person.spaceSlug ?? chatSpaceSlug);
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
      const spaceSlug = person.spaceSlug ?? chatSpaceSlug;
      showRoom(roomId, title, spaceSlug);
      const start = video ? startVideoForRoom : startAudioForRoom;
      await start(roomId, spaceSlug, undefined, jwt, {
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
    <p className="text-1 text-error-11" role="alert">
      {notice}
    </p>
  );
}
