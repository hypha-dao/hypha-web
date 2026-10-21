'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useJwt } from '@hypha-platform/core/client';

import { PersonAvatar } from './person-avatar';

type PersonHit = {
  id: number;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl: string | null;
};

function personLabel(person: PersonHit) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || String(person.id);
}

export function SpaceMemberInviteButton({
  spaceSlug,
  lang,
}: {
  spaceSlug: string;
  lang: string;
}) {
  const t = useTranslations('MembersTab');
  const { jwt } = useJwt();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState(false);

  useEffect(() => {
    if (!open || !jwt || query.trim().length < 2) {
      setPeople([]);
      setSearching(false);
      return;
    }
    const handle = window.setTimeout(() => {
      const term = query.trim();
      setSearching(true);
      void fetch(`/api/v1/people/search?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
        .then(async (response) => {
          if (!response.ok) return [];
          const body = (await response.json()) as { people?: PersonHit[] };
          return body.people ?? [];
        })
        .then((next) => {
          setPeople(next);
          setSelectedId((current) => {
            if (next.length === 1) return next[0]?.id ?? null;
            if (
              current != null &&
              next.some((person) => person.id === current)
            ) {
              return current;
            }
            return null;
          });
        })
        .catch(() => {
          setPeople([]);
          setSelectedId(null);
        })
        .finally(() => {
          setSearching(false);
        });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [jwt, open, query]);

  function closeDialog(next: boolean) {
    setOpen(next);
    if (next) return;
    setQuery('');
    setPeople([]);
    setSelectedId(null);
    setSearching(false);
    setMessage(null);
    setMessageError(false);
  }

  async function sendInvite() {
    if (!jwt || selectedId == null) return;
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/member-invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ personId: selectedId, lang }),
        },
      );
      if (response.ok) {
        setMessageError(false);
        setMessage(t('inviteSent'));
        setSelectedId(null);
        setQuery('');
        setPeople([]);
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        reason?: string;
      } | null;
      setMessageError(true);
      if (body?.reason === 'already-member') {
        setMessage(t('inviteAlreadyMember'));
      } else if (body?.reason === 'self') {
        setMessage(t('inviteSelf'));
      } else if (body?.reason === 'not-member') {
        setMessage(t('inviteNotMember'));
      } else {
        setMessage(t('inviteError'));
      }
    } catch {
      setMessageError(true);
      setMessage(t('inviteError'));
    } finally {
      setSending(false);
    }
  }

  const showEmpty =
    !searching && query.trim().length >= 2 && people.length === 0 && !message;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        colorVariant="neutral"
        onClick={() => setOpen(true)}
      >
        {t('inviteMember')}
      </Button>
      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogTitle
            className="pr-8 text-3"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('inviteTitle')}
          </DialogTitle>
          <Input
            type="search"
            value={query}
            placeholder={t('inviteSearch')}
            aria-label={t('inviteSearch')}
            autoFocus
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId(null);
              setMessage(null);
            }}
          />
          {searching ? (
            <p className="text-1 text-neutral-11">{t('loading')}</p>
          ) : null}
          {people.length > 0 ? (
            <ul className="grid max-h-64 gap-1 overflow-y-auto">
              {people.map((person) => {
                const selected = person.id === selectedId;
                const label = personLabel(person);
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedId(person.id);
                        setMessage(null);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-2 py-2 text-left',
                        selected ? 'bg-accent-2' : 'hover:bg-accent-2',
                      )}
                    >
                      <PersonAvatar
                        avatarSrc={person.avatarUrl ?? undefined}
                        userName={label}
                        size="sm"
                        shape="circle"
                        personId={person.id}
                      />
                      <span className="min-w-0 flex-1 truncate text-2">
                        {label}
                      </span>
                      <Check
                        aria-hidden
                        className={cn(
                          'size-4 shrink-0',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {showEmpty ? (
            <p className="text-1 text-neutral-11">{t('inviteNone')}</p>
          ) : null}
          <Button
            type="button"
            className="w-full"
            disabled={selectedId == null || sending || !jwt}
            onClick={() => {
              void sendInvite();
            }}
          >
            {t('inviteSend')}
          </Button>
          {people.length > 1 && selectedId == null ? (
            <p className="text-1 text-neutral-11">{t('invitePick')}</p>
          ) : null}
          {message ? (
            <p
              className={
                messageError ? 'text-1 text-error-11' : 'text-1 text-neutral-11'
              }
              role={messageError ? 'alert' : 'status'}
            >
              {message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
