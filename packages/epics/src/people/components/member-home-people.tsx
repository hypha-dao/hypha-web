'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, Phone, Video } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  findNamedDirectRoomId,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useSpaceGroupCall,
  type Message,
} from '@hypha-platform/core/client';

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
  onOpenChatReady?: (openChat: MemberHomeOpenChat) => void;
};

function labelOf(person: HomePerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

function revealPeoplePanel() {
  window.requestAnimationFrame(() => {
    document.getElementById('member-home-people')?.scrollIntoView({
      block: 'nearest',
    });
  });
}

export function MemberHomePeople({
  people,
  chatSpaceSlug,
  fallbackName,
  onOpenChatReady,
}: MemberHomePeopleProps) {
  const t = useTranslations('MemberHome');
  const { jwt } = useJwt();
  const matrix = useMatrix();
  const [gathering, setGathering] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState<HomePerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [thread, setThread] = useState<{
    roomId: string;
    title: string;
  } | null>(null);
  const [lines, setLines] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [liveRoomId, setLiveRoomId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingEnter = useRef<'audio' | 'video' | null>(null);
  const openPersonChatRef = useRef<MemberHomeOpenChat>(async () => false);

  const personIds = useMemo(
    () => [...people, ...network].map((person) => person.id),
    [people, network],
  );
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

  useEffect(() => {
    if (!thread) return;
    const read = () => {
      const next = matrix.getRoomMessages(thread.roomId);
      if (next) setLines(next.filter((line) => !line.redacted && line.content));
    };
    read();
    const timer = window.setInterval(read, 3000);
    return () => window.clearInterval(timer);
  }, [matrix, thread]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || !jwt) {
      setNetwork([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void fetch(`/api/v1/people/search?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${jwt}` },
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return { people: [] as HomePerson[] };
          return (await response.json()) as { people: HomePerson[] };
        })
        .then((body) => {
          const known = new Set(people.map((person) => person.id));
          setNetwork(body.people.filter((person) => !known.has(person.id)));
        })
        .catch(() => {
          if (!controller.signal.aborted) setNetwork([]);
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [jwt, people, query]);

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
        setThread({ roomId: existing, title });
        revealPeoplePanel();
        return true;
      }
    }
    if (!matrix.isAuthenticated || !client || !mxid) return false;
    try {
      const roomId = await openRoom(title, [person.id]);
      if (!roomId) return false;
      setThread({ roomId, title });
      revealPeoplePanel();
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

  async function startChat(person: HomePerson) {
    const opened = await openPersonChat(person);
    if (!opened) setNotice(t('matrixUnavailable'));
  }

  async function startCall(ids: number[], video: boolean, title: string) {
    setNotice(null);
    try {
      const roomId = await openRoom(title, ids);
      if (!roomId) {
        setNotice(t('matrixUnavailable'));
        return;
      }
      pendingEnter.current = video ? 'video' : 'audio';
      setLiveRoomId(roomId);
      setThread({ roomId, title });
      setGathering(false);
      setPicked([]);
    } catch {
      setNotice(t('callFailed'));
    }
  }

  function togglePick(id: number) {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  const recommendedId = people[0]?.id;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('peopleTitle')}
        </h2>
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          onClick={() => {
            setGathering((open) => !open);
            setPicked([]);
          }}
        >
          {gathering ? t('gatherCancel') : t('gather')}
        </Button>
      </div>
      <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
        {t('peopleInSpaces')}
      </p>
      <ul className="grid gap-3">
        {people.length === 0 ? (
          <li className="text-2 text-neutral-11">{t('noConnections')}</li>
        ) : (
          people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              fallbackName={fallbackName}
              recommended={person.id === recommendedId}
              gathering={gathering}
              picked={picked.includes(person.id)}
              onToggle={() => togglePick(person.id)}
              onChat={() => {
                void startChat(person);
              }}
              onCall={(video) => {
                void startCall(
                  [person.id],
                  video,
                  labelOf(person, fallbackName),
                );
              }}
            />
          ))
        )}
      </ul>
      {gathering ? (
        <div className="flex flex-wrap items-center gap-2 border border-border p-3">
          <Button
            type="button"
            disabled={picked.length < 2}
            onClick={() => {
              void startCall(picked, false, t('groupCall'));
            }}
          >
            {t('callTogether')}
          </Button>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={picked.length < 2}
            onClick={() => {
              void startCall(picked, true, t('groupCall'));
            }}
          >
            {t('withVideo')}
          </Button>
          {picked.length < 2 ? (
            <p className="text-1 text-neutral-11">{t('pickTwo')}</p>
          ) : null}
        </div>
      ) : null}

      <label className="grid gap-2">
        <span className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
          {t('widerNetwork')}
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-10 border border-border bg-background px-3 text-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </label>
      {searching ? (
        <p className="text-1 text-neutral-11">{t('searching')}</p>
      ) : null}
      {network.length > 0 ? (
        <ul className="grid gap-3">
          {network.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              fallbackName={fallbackName}
              gathering={gathering}
              picked={picked.includes(person.id)}
              onToggle={() => togglePick(person.id)}
              onChat={() => {
                void startChat(person);
              }}
              onCall={(video) => {
                void startCall(
                  [person.id],
                  video,
                  labelOf(person, fallbackName),
                );
              }}
            />
          ))}
        </ul>
      ) : query.trim().length >= 2 && !searching ? (
        <p className="text-2 text-neutral-11">{t('noSearchResults')}</p>
      ) : null}

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

      {thread ? (
        <section className="border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-2 font-medium">{thread.title}</h3>
            <button
              type="button"
              className="text-1 text-neutral-11 underline-offset-4 hover:underline"
              onClick={() => setThread(null)}
            >
              {t('closeChat')}
            </button>
          </div>
          <ul className="mt-3 grid max-h-48 gap-2 overflow-y-auto">
            {lines.length === 0 ? (
              <li className="text-1 text-neutral-11">{t('chatEmpty')}</li>
            ) : (
              lines.slice(-20).map((line) => (
                <li key={line.id} className="text-2">
                  <span className="text-1 text-neutral-11">{line.sender}</span>
                  <p>{line.content}</p>
                </li>
              ))
            )}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              setDraft('');
              void matrix
                .sendMessage({ roomId: thread.roomId, message: text })
                .catch(() => setNotice(t('matrixFailed')));
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={t('chatWith')}
              className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button type="submit">{t('send')}</Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function PersonRow({
  person,
  fallbackName,
  recommended = false,
  gathering,
  picked,
  onToggle,
  onChat,
  onCall,
}: {
  person: HomePerson;
  fallbackName: string;
  recommended?: boolean;
  gathering: boolean;
  picked: boolean;
  onToggle: () => void;
  onChat: () => void;
  onCall: (video: boolean) => void;
}) {
  const t = useTranslations('MemberHome');
  const name = labelOf(person, fallbackName);
  return (
    <li
      className={cn(
        'flex items-center gap-2 border border-transparent px-1 py-1',
        picked && 'border-foreground',
      )}
    >
      {gathering ? (
        <button
          type="button"
          aria-pressed={picked}
          onClick={onToggle}
          className="h-4 w-4 border border-foreground"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-2">{name}</p>
        {recommended ? (
          <p className="text-1 text-neutral-11">{t('recommended')}</p>
        ) : person.sharedSpaceCount ? (
          <p className="text-1 text-neutral-11">
            {t('sharedSpaces', { count: person.sharedSpaceCount })}
          </p>
        ) : (
          <p className="text-1 text-neutral-11">{t('widerNetwork')}</p>
        )}
      </div>
      {!gathering ? (
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            colorVariant="neutral"
            aria-label={t('callPerson', { name })}
            onClick={() => onCall(false)}
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            colorVariant="neutral"
            aria-label={t('videoPerson', { name })}
            onClick={() => onCall(true)}
          >
            <Video className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            colorVariant="neutral"
            aria-label={t('chatPerson', { name })}
            onClick={onChat}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}
