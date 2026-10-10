'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import {
  findNamedDirectRoomId,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useSpaceGroupCall,
} from '@hypha-platform/core/client';

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
  const { jwt } = useJwt();
  const matrix = useMatrix();
  const [liveRoomId, setLiveRoomId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingEnter = useRef<'audio' | 'video' | null>(null);
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
  const call = useSpaceGroupCall(liveRoomId, {
    authToken: jwt,
    spaceSlug: chatSpaceSlug,
  });

  useEffect(() => {
    const mode = pendingEnter.current;
    if (!mode || !liveRoomId) return;
    pendingEnter.current = null;
    const start = mode === 'video' ? call.enterVideo : call.enterAudio;
    void start().catch(() => setNotice(t('callFailed')));
  }, [call.enterAudio, call.enterVideo, liveRoomId, t]);

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

  function showRoom(roomId: string, title: string) {
    openCoherenceChat(roomId, title, '');
  }

  async function openPersonChat(person: HomePerson): Promise<boolean> {
    setNotice(null);
    const title = labelOf(person, fallbackName);
    const mxid = personIdToMatrixUserId[person.id];
    const client = matrix.client;
    const selfId = client?.getUserId() ?? '';
    if (matrix.isAuthenticated && client && mxid && selfId) {
      const existing = findNamedDirectRoomId(
        readJoinedPeopleRooms(client).named,
        selfId,
        mxid,
        title,
      );
      if (existing) {
        showRoom(existing, title);
        return true;
      }
    }
    if (!matrix.isAuthenticated || !client || !mxid) return false;
    try {
      const roomId = await openRoom(title, [person.id]);
      if (!roomId) return false;
      showRoom(roomId, title);
      return true;
    } catch {
      setNotice(t('matrixFailed'));
      return true;
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
    try {
      const title = labelOf(person, fallbackName);
      const roomId = await openRoom(title, [person.id]);
      if (!roomId) {
        setNotice(t('matrixUnavailable'));
        return false;
      }
      pendingEnter.current = video ? 'video' : 'audio';
      setLiveRoomId(roomId);
      showRoom(roomId, title);
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

  if (!notice && call.callState === 'idle') return null;

  return (
    <div className="grid gap-3">
      {notice ? (
        <p className="text-2 text-error-11" role="alert">
          {notice}
        </p>
      ) : null}
      {call.callState !== 'idle' ? (
        <div className="flex items-center justify-between gap-2 border border-border bg-background-2 p-3">
          <p className="text-2">{t('inCall')}</p>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            onClick={() => {
              void call.leave();
              setLiveRoomId(null);
            }}
          >
            {t('hangUp')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
