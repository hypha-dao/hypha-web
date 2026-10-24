'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
} from '@hypha-platform/core/client';

import { useGlobalCallDock } from '../../common/global-call-dock-context';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import {
  noticeKeyForOpenPersonRoomError,
  openOrEnsurePersonRoom,
} from './open-person-room';

type HomePerson = {
  id: number;
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  sharedSpaceCount?: number;
  /** Wallet used when the chat panel loads this person's spaces. */
  address?: string | null;
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
  onNotice?: (notice: string | null) => void;
};

function labelOf(person: HomePerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

/** Keeps Matrix ready for the connections grid and opens that room in the comms panel. */
export function MemberHomePeople({
  people,
  chatSpaceSlug: _chatSpaceSlug,
  fallbackName,
  extraPersonIds,
  onOpenChatReady,
  onOpenCallReady,
  onOpenVideoReady,
  onNotice,
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
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;
  const matrixIdsRef = useRef(personIdToMatrixUserId);
  matrixIdsRef.current = personIdToMatrixUserId;
  const knownMatrixIdsRef = useRef<Record<number, string>>({});
  if (Object.keys(personIdToMatrixUserId).length > 0) {
    knownMatrixIdsRef.current = {
      ...knownMatrixIdsRef.current,
      ...personIdToMatrixUserId,
    };
  }
  const openChainRef = useRef(Promise.resolve());

  function showRoom(roomId: string | null, title: string, person?: HomePerson) {
    // PM / group rooms are private — never attach a space slug or the AI and
    // @-mentions inherit that space's roster.
    const peerSlug = person?.slug?.trim();
    openCoherenceChat(roomId, title, '', null, null, {
      peerPerson: peerSlug
        ? { slug: peerSlug, address: person?.address ?? null }
        : null,
    });
  }

  async function waitForMatrixUserId(personId: number) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const mxid =
        matrixIdsRef.current[personId] ?? knownMatrixIdsRef.current[personId];
      if (mxid) return mxid;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return (
      matrixIdsRef.current[personId] ??
      knownMatrixIdsRef.current[personId] ??
      null
    );
  }

  async function resolvePersonRoom(person: HomePerson, title: string) {
    try {
      return await openOrEnsurePersonRoom({
        getMatrix: () => matrixRef.current,
        personId: person.id,
        title,
        waitForMatrixUserId,
      });
    } catch (error) {
      setNotice(t(noticeKeyForOpenPersonRoomError(error)));
      return null;
    }
  }

  async function openPersonChat(person: HomePerson): Promise<boolean> {
    const run = openChainRef.current.then(() => openPersonChatNow(person));
    openChainRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function openPersonChatNow(person: HomePerson): Promise<boolean> {
    setNotice(null);
    const title = labelOf(person, fallbackName);
    try {
      const roomId = await resolvePersonRoom(person, title);
      if (!roomId) return false;
      showRoom(roomId, title, person);
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
      if (!roomId) return false;
      showRoom(roomId, title, person);
      const start = video ? startVideoForRoom : startAudioForRoom;
      await start(roomId, null, undefined, jwt, {
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

  useEffect(() => {
    onNotice?.(notice);
    return () => onNotice?.(null);
  }, [notice, onNotice]);

  if (!notice) return null;

  return (
    <p className="text-1 text-error-11" role="alert">
      {notice}
    </p>
  );
}
