'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Space,
  useMe,
  useMatrix,
  type Message,
} from '@hypha-platform/core/client';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import { Locale } from '@hypha-platform/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  Container,
  Input,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useNetworkSharedSpaces } from '../use-network-shared-spaces';
import { useNetworkPeople } from '../use-network-people';
import type { NetworkPerson } from '../network-pulse';

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'P';
}

export function NetworkConnectPage({
  lang,
  spaces,
  initialPersonSlug,
}: {
  lang: Locale;
  spaces: Space[];
  initialPersonSlug?: string | null;
}) {
  const t = useTranslations('Journey');
  const searchParams = useSearchParams();
  const personFromQuery =
    initialPersonSlug?.trim() || searchParams.get('person')?.trim() || '';
  const { person } = useMe();
  const { getAccessToken } = useAccessTokenReady();
  const { sharedSpaces } = useNetworkSharedSpaces(spaces);
  const spaceSlugs = useMemo(
    () =>
      sharedSpaces
        .map((space) => space.slug)
        .filter((slug): slug is string => Boolean(slug)),
    [sharedSpaces],
  );
  const { people, isLoading } = useNetworkPeople({
    spaceSlugs,
    excludeSlug: person?.slug,
    pageSize: 40,
  });

  const [selected, setSelected] = useState<NetworkPerson | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const {
    isMatrixAvailable,
    isAuthenticated: isMatrixReady,
    joinRoom,
    loadRoomHistory,
    getRoomMessages,
    sendMessage,
    registerRoomListener,
    unregisterRoomListener,
  } = useMatrix();

  useEffect(() => {
    if (!personFromQuery) return;
    const match = people.find((entry) => entry.slug === personFromQuery);
    if (match) setSelected(match);
  }, [people, personFromQuery]);

  const refreshMessages = useCallback(
    (id: string) => {
      try {
        setMessages(getRoomMessages(id) ?? []);
      } catch {
        setMessages([]);
      }
    },
    [getRoomMessages],
  );

  useEffect(() => {
    let cancelled = false;
    const openConversation = async () => {
      if (!selected?.id) {
        setRoomId(null);
        setMessages([]);
        setDmError(null);
        return;
      }
      setIsOpening(true);
      setDmError(null);
      try {
        const token = await getAccessToken();
        const response = await fetch('/api/v1/network/dm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ peerPersonId: selected.id }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            payload?.error ||
              (response.status === 409
                ? t('connectDmUnavailable')
                : t('connectDmError')),
          );
        }
        const payload = (await response.json()) as { roomId?: string };
        const nextRoomId = payload.roomId?.trim();
        if (!nextRoomId) throw new Error(t('connectDmError'));
        if (!isMatrixAvailable || !isMatrixReady) {
          throw new Error(t('connectDmUnavailable'));
        }
        const joined = await joinRoom(nextRoomId);
        await loadRoomHistory(joined, { force: true });
        if (cancelled) return;
        setRoomId(joined);
        refreshMessages(joined);
      } catch (error) {
        if (cancelled) return;
        setRoomId(null);
        setMessages([]);
        setDmError(
          error instanceof Error ? error.message : t('connectDmError'),
        );
      } finally {
        if (!cancelled) setIsOpening(false);
      }
    };
    void openConversation();
    return () => {
      cancelled = true;
    };
  }, [
    getAccessToken,
    isMatrixAvailable,
    isMatrixReady,
    joinRoom,
    loadRoomHistory,
    refreshMessages,
    selected?.id,
    t,
  ]);

  useEffect(() => {
    if (!roomId) return;
    registerRoomListener(
      roomId,
      async () => {
        refreshMessages(roomId);
      },
      async () => undefined,
    );
    return () => unregisterRoomListener(roomId);
  }, [registerRoomListener, refreshMessages, roomId, unregisterRoomListener]);

  const handleSend = async () => {
    if (!roomId || !draft.trim()) return;
    await sendMessage({ roomId, message: draft });
    setDraft('');
    refreshMessages(roomId);
  };

  return (
    <Container size="lg" className="flex min-w-0 flex-col gap-6 py-8 md:py-10">
      <header>
        <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
          {t('connectTitle')}
        </p>
        <h1 className="craft-page-title mt-1 [font-family:var(--font-family-heading)] text-7 font-semibold tracking-[-0.02em]">
          {t('connectPageTitle')}
        </h1>
        <p className="mt-2 max-w-[52ch] text-3 leading-relaxed text-muted-foreground">
          {t('connectPageLead')}
        </p>
      </header>

      <div className="grid min-h-0 items-stretch gap-4 lg:grid-cols-12 lg:h-[calc(100dvh-var(--menu-top-height,70px)-12rem)]">
        <Card className="craft-card min-h-[20rem] lg:col-span-4 lg:h-full">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold">
              {t('connectTitle')}
            </h2>
            {isLoading ? (
              <p className="text-2 text-muted-foreground">
                {t('connectLoading')}
              </p>
            ) : people.length === 0 ? (
              <p className="text-2 text-muted-foreground">
                {t('connectEmpty')}
              </p>
            ) : (
              <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                {people.map((entry) => (
                  <li key={entry.slug}>
                    <button
                      type="button"
                      onClick={() => setSelected(entry)}
                      className={cn(
                        'craft-row-interactive flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left',
                        selected?.slug === entry.slug && 'bg-neutral-3',
                      )}
                    >
                      <Avatar className="size-10 rounded-full">
                        <AvatarImage
                          src={entry.avatarUrl ?? undefined}
                          alt=""
                        />
                        <AvatarFallback className="rounded-full text-2">
                          {initials(entry.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-2">{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="craft-card min-h-[24rem] lg:col-span-8 lg:h-full">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <h2 className="[font-family:var(--font-family-heading)] text-4 font-semibold">
              {selected ? selected.name : t('connectChatTitle')}
            </h2>
            {!selected ? (
              <p className="text-2 text-muted-foreground">
                {t('connectMessagesEmpty')}
              </p>
            ) : isOpening ? (
              <p className="text-2 text-muted-foreground">
                {t('connectLoading')}
              </p>
            ) : dmError ? (
              <p className="text-2 text-error-11">{dmError}</p>
            ) : (
              <>
                <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      className="rounded-xl bg-neutral-3 px-3 py-2"
                    >
                      <p className="text-1 text-muted-foreground">
                        {message.sender}
                      </p>
                      <p className="text-2 whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSend();
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={t('connectComposerPlaceholder')}
                    disabled={!roomId}
                  />
                  <Button type="submit" disabled={!roomId || !draft.trim()}>
                    {t('connectSend')}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">{lang}</span>
    </Container>
  );
}
