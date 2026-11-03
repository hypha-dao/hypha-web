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

export type DirectoryPerson = {
  id: number;
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
  slug?: string | null;
  address?: string | null;
};

function labelOf(person: DirectoryPerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

/** Opens a direct message, call, or video with a member from the directory. */
export function useMemberDirectoryConnect(people: DirectoryPerson[]) {
  const t = useTranslations('MemberHome');
  const tCommon = useTranslations('Common');
  const { openCoherenceChat } = useHumanChatPanel();
  const { startAudioForRoom, startVideoForRoom } = useGlobalCallDock();
  const { jwt } = useJwt();
  const matrix = useMatrix();
  const [notice, setNotice] = useState<string | null>(null);

  const personIds = useMemo(() => {
    const ids = new Set<number>();
    for (const person of people) ids.add(person.id);
    return [...ids];
  }, [people]);
  const { personIdToMatrixUserId, isLoading: matrixIdsLoading } =
    useMatrixUserIdsByPersonIds({ personIds });

  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;
  const matrixIdsRef = useRef(personIdToMatrixUserId);
  matrixIdsRef.current = personIdToMatrixUserId;
  const matrixIdsLoadingRef = useRef(matrixIdsLoading);
  matrixIdsLoadingRef.current = matrixIdsLoading;

  function showRoom(
    roomId: string | null,
    title: string,
    person: DirectoryPerson,
  ) {
    const peerSlug = person.slug?.trim();
    const peerId = person.id > 0 ? person.id : undefined;
    openCoherenceChat(roomId, title, '', null, null, {
      peerPerson:
        peerSlug || peerId
          ? {
              slug: peerSlug || '',
              address: person.address ?? null,
              id: peerId,
            }
          : null,
    });
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

  async function resolvePersonRoom(person: DirectoryPerson, title: string) {
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

  async function openChat(person: DirectoryPerson) {
    setNotice(null);
    const title = labelOf(person, tCommon('memberRoleLabel'));
    try {
      const roomId = await resolvePersonRoom(person, title);
      if (!roomId) return;
      showRoom(roomId, title, person);
    } catch {
      setNotice(t('matrixFailed'));
    }
  }

  async function openMedia(person: DirectoryPerson, video: boolean) {
    setNotice(null);
    const title = labelOf(person, tCommon('memberRoleLabel'));
    try {
      const roomId = await resolvePersonRoom(person, title);
      if (!roomId) return;
      showRoom(roomId, title, person);
      const start = video ? startVideoForRoom : startAudioForRoom;
      await start(roomId, null, undefined, jwt, { roomTitle: title });
    } catch {
      setNotice(t('callFailed'));
    }
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return {
    openChat,
    openCall: (person: DirectoryPerson) => openMedia(person, false),
    openVideo: (person: DirectoryPerson) => openMedia(person, true),
    notice,
  };
}
