'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  CAPITALS,
  EXCHANGE_CAPITALS_DRAFT_KEY,
  type CapitalKey,
} from '@hypha-platform/core/client';
import { useJwt } from '@hypha-platform/core/client';
import { Input, Textarea } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const DRAFT_KEY = EXCHANGE_CAPITALS_DRAFT_KEY;

function toggle(list: CapitalKey[], key: CapitalKey): CapitalKey[] {
  return list.includes(key)
    ? list.filter((item) => item !== key)
    : [...list, key];
}

export function NetworkQuickCreate({ lang }: { lang: Locale }) {
  const t = useTranslations('NetworkExchange');
  const router = useRouter();
  const { jwt } = useJwt();
  const [spaces, setSpaces] = useState<{ slug: string; title: string }[]>([]);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [place, setPlace] = useState('');
  const [spaceSlug, setSpaceSlug] = useState(spaces[0]?.slug ?? '');
  const [seeks, setSeeks] = useState<CapitalKey[]>(['financial']);
  const [offers, setOffers] = useState<CapitalKey[]>(['social']);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!jwt) return;
    let cancelled = false;
    void (async () => {
      const me = await fetch('/api/v1/people/me', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!me.ok) return;
      const person = (await me.json()) as { slug?: string };
      if (!person.slug) return;
      const list = await fetch(`/api/v1/people/${person.slug}/spaces`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!list.ok) return;
      const rows = (await list.json()) as { slug?: string; title?: string }[];
      if (cancelled || !Array.isArray(rows)) return;
      const next = rows.flatMap((row) =>
        row.slug && row.title ? [{ slug: row.slug, title: row.title }] : [],
      );
      setSpaces(next);
      setSpaceSlug((current) => current || next[0]?.slug || '');
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt]);

  const chips = (
    selected: CapitalKey[],
    setSelected: (next: CapitalKey[]) => void,
  ) => (
    <div className="flex flex-wrap gap-1">
      {CAPITALS.map((key) => {
        const on = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(toggle(selected, key))}
            className={cn(
              'border px-2 py-1 text-1',
              on
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-neutral-11',
            )}
          >
            {t(`capitals.${key}`)}
          </button>
        );
      })}
    </div>
  );

  const remember = () => {
    const draft = { name, purpose, place, seeks, offers };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  };

  const saveOnSpace = async () => {
    if (!spaceSlug || !jwt) return;
    setSaving(true);
    setNote(null);
    try {
      const response = await fetch('/api/v1/network/space-capitals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spaceSlug, seeks, offers }),
      });
      const body = (await response.json()) as { saved?: boolean };
      setNote(body.saved ? t('saved') : t('saveLater'));
    } catch {
      setNote(t('saveLater'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-xl gap-5">
      <div>
        <h1
          className="text-5"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('createTitle')}
        </h1>
        <p className="mt-2 text-2 leading-relaxed text-neutral-11">
          {t('createBody')}
        </p>
      </div>
      <label className="grid gap-1 text-1 text-neutral-11">
        {t('spaceName')}
        <Input
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-1 text-neutral-11">
        {t('purpose')}
        <Textarea
          value={purpose}
          maxLength={300}
          rows={3}
          onChange={(event) => setPurpose(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-1 text-neutral-11">
        {t('place')}
        <Input
          value={place}
          maxLength={80}
          onChange={(event) => setPlace(event.target.value)}
        />
      </label>
      <div>
        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('seeks')}
        </p>
        <div className="mt-2">{chips(seeks, setSeeks)}</div>
      </div>
      <div>
        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('offers')}
        </p>
        <div className="mt-2">{chips(offers, setOffers)}</div>
      </div>
      {spaces.length > 0 ? (
        <label className="grid gap-1 text-1 text-neutral-11">
          {t('attach')}
          <select
            value={spaceSlug}
            onChange={(event) => setSpaceSlug(event.target.value)}
            className="h-10 border border-border bg-background px-2 text-2 text-foreground"
          >
            {spaces.map((space) => (
              <option key={space.slug} value={space.slug}>
                {space.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {note ? <p className="text-2 text-neutral-11">{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        {spaces.length > 0 ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              void saveOnSpace();
            }}
            className="border border-border px-3 py-2 text-1 uppercase tracking-[0.12em]"
          >
            {t('saveCapitals')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            remember();
            const params = new URLSearchParams();
            if (name.trim()) params.set('name', name.trim());
            if (purpose.trim()) params.set('purpose', purpose.trim());
            router.push(`/${lang}/interactive-create?${params.toString()}`);
          }}
          className="border border-foreground bg-foreground px-3 py-2 text-1 uppercase tracking-[0.12em] text-background disabled:opacity-40"
        >
          {t('continueCreate')}
        </button>
      </div>
    </div>
  );
}
