'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { useJwt } from '@hypha-platform/core/client';

type PersonHit = {
  id: number;
  name: string | null;
  surname: string | null;
  nickname: string | null;
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
        })
        .catch(() => {
          setPeople([]);
        })
        .finally(() => {
          setSearching(false);
        });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [jwt, open, query]);

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

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        colorVariant="neutral"
        onClick={() => {
          setOpen((value) => !value);
          setMessage(null);
        }}
      >
        {open ? t('inviteClose') : t('inviteMember')}
      </Button>
      {open ? (
        <div className="w-full min-w-64 border border-border bg-background p-3 lg:w-72">
          <label className="grid gap-2">
            <span className="text-1 text-neutral-11">{t('inviteSearch')}</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(null);
                setMessage(null);
              }}
              className="h-10 border border-border bg-background px-3 text-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
          {searching ? (
            <p className="mt-2 text-1 text-neutral-11">{t('loading')}</p>
          ) : null}
          {people.length > 0 ? (
            <ul className="mt-2 grid max-h-40 gap-1 overflow-y-auto">
              {people.map((person) => {
                const selected = person.id === selectedId;
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedId(person.id)}
                      className={
                        selected
                          ? 'w-full border border-foreground px-2 py-2 text-left text-2'
                          : 'w-full border border-transparent px-2 py-2 text-left text-2 hover:border-border'
                      }
                    >
                      {personLabel(person)}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <Button
            type="button"
            className="mt-3"
            disabled={selectedId == null || sending || !jwt}
            onClick={() => {
              void sendInvite();
            }}
          >
            {t('inviteSend')}
          </Button>
          {selectedId == null ? (
            <p className="mt-2 text-1 text-neutral-11">{t('invitePick')}</p>
          ) : null}
          {message ? (
            <p
              className={
                messageError
                  ? 'mt-2 text-1 text-error-11'
                  : 'mt-2 text-1 text-neutral-11'
              }
              role={messageError ? 'alert' : 'status'}
            >
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
