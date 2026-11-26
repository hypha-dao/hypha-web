'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Checkbox,
} from '@hypha-platform/ui';
import {
  AUTH_SERVER_API_BASE_PATH,
  MAX_SPACE_GRANTS,
  SCOPES_REQUIRING_SPACES_READ,
  describeClient,
  type ClientKind,
  type ScopeCopyKey,
} from '@hypha-platform/auth-server/client';

type Scope = {
  scope: string;
  copyKey: ScopeCopyKey;
  defaultGranted: boolean;
  warn: boolean;
};

/** Scopes that act in the spaces chosen under `spaces:read`: only offered while it is ticked. */
const needsSpacesRead = (scope: string) =>
  (SCOPES_REQUIRING_SPACES_READ as readonly string[]).includes(scope);

type PickerSpace = {
  id: number;
  title: string;
  slug: string;
  logoUrl: string | null;
};

export function ConsentForm({
  oauthQuery,
  personId,
  personName,
  client,
  scopes,
  pickerSpaces,
}: {
  oauthQuery: string;
  personId: string;
  personName: string;
  client: {
    kind: ClientKind;
    name: string;
    host: string;
    redirectHost: string;
  };
  scopes: Scope[];
  /** Spaces the person can pick; null = could not be read (only "all my spaces" is offered). */
  pickerSpaces: PickerSpace[] | null;
}) {
  const t = useTranslations('AuthServer');
  const [granted, setGranted] = React.useState<Set<string>>(
    () => new Set(scopes.filter((s) => s.defaultGranted).map((s) => s.scope)),
  );
  // Which spaces the app may read. Explicit by default and preselected up to the limit; "all"
  // is a separate choice that also covers spaces joined later (it is not "tick everything").
  const [mode, setMode] = React.useState<'spaces' | 'all'>('all');
  const [chosen, setChosen] = React.useState<Set<number>>(
    () =>
      new Set((pickerSpaces ?? []).slice(0, MAX_SPACE_GRANTS).map((x) => x.id)),
  );
  const [filter, setFilter] = React.useState('');
  const overLimit = (pickerSpaces?.length ?? 0) > MAX_SPACE_GRANTS;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const toggle = (scope: string, on: boolean) =>
    setGranted((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
      // Unticking the read scope also unticks what acts in the spaces chosen under it.
      if (!on && scope === 'spaces:read')
        for (const other of prev)
          if (needsSpacesRead(other)) next.delete(other);
      return next;
    });

  const toggleSpace = (id: number, on: boolean) =>
    setChosen((prev) => {
      if (on && prev.size >= MAX_SPACE_GRANTS) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = async (accept: boolean) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${AUTH_SERVER_API_BASE_PATH}/oauth2/consent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          accept,
          scope: accept ? [...granted].join(' ') : undefined,
          // Without the read scope there is nothing to limit; the resource checks the scope too.
          space_grants: accept
            ? !granted.has('spaces:read') || mode === 'all'
              ? 'all'
              : [...chosen]
            : undefined,
          oauth_query: oauthQuery,
          // The account this page showed: an approval from another session is refused.
          expected_person: personId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      // Another account signed in (another tab) after this page was shown: nothing was saved.
      if (body.error === 'account_changed') {
        setError(t('approval.accountChanged'));
        setBusy(false);
        return;
      }
      // The signed approval link ran out while the page was open.
      if (body.error === 'invalid_signature') {
        setError(t('approval.expired'));
        setBusy(false);
        return;
      }
      setError(t('consent.failed'));
    } catch {
      setError(t('consent.failed'));
    }
    setBusy(false);
  };

  const hasRead = scopes.some(
    (s) => s.scope !== 'offline_access' && granted.has(s.scope),
  );
  const showPicker = granted.has('spaces:read');
  const needsSpaces = showPicker && mode === 'spaces' && chosen.size === 0;
  const needle = filter.trim().toLowerCase();
  const visibleSpaces = (pickerSpaces ?? []).filter(
    (x) =>
      !needle ||
      x.title.toLowerCase().includes(needle) ||
      x.slug.toLowerCase().includes(needle),
  );

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-4 font-medium">
        {t('consent.title', { name: client.name })}
      </h1>
      <p role="note" className="border border-warning-8 p-3 text-2">
        {(() => {
          const copy = describeClient({ ...client });
          return t.rich(`consent.client.${copy.key}`, {
            ...copy.values,
            strong: (chunks) => <strong className="break-all">{chunks}</strong>,
          });
        })()}
      </p>
      <p className="text-2 text-neutral-11">
        {t('consent.signedInAs', { name: personName })}
      </p>
      <ul className="flex flex-col gap-3">
        {scopes.map((s) => (
          <li key={s.scope} className="flex items-start gap-3">
            <Checkbox
              id={`scope-${s.scope}`}
              checked={granted.has(s.scope)}
              disabled={needsSpacesRead(s.scope) && !granted.has('spaces:read')}
              onCheckedChange={(v) => toggle(s.scope, v === true)}
            />
            <label htmlFor={`scope-${s.scope}`} className="flex flex-col">
              <span className="text-2 font-medium">
                {s.copyKey === 'unknown'
                  ? s.scope
                  : t(`consent.scopes.${s.copyKey}.title`)}
              </span>
              <span className="text-1 text-neutral-11">
                {t(`consent.scopes.${s.copyKey}.detail`)}
              </span>
              {s.warn ? (
                <span
                  role="note"
                  className="text-1 font-medium text-warning-11"
                >
                  {t(`consent.scopes.${s.copyKey}.warning`)}
                </span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
      {showPicker ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-2 font-medium">
            {[...granted].some(needsSpacesRead)
              ? t('consent.spaces.titleWithWrite')
              : t('consent.spaces.title')}
          </legend>
          <label className="flex items-start gap-3 border p-3">
            <input
              type="radio"
              name="space-mode"
              className="mt-1"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
            />
            <span className="flex flex-col">
              <span className="text-2 font-medium">
                {t('consent.spaces.all.title')}
              </span>
              <span className="text-1 text-neutral-11">
                {t('consent.spaces.all.detail')}
              </span>
            </span>
          </label>
          <label
            className={`flex items-start gap-3 border p-3 ${
              pickerSpaces ? '' : 'opacity-60'
            }`}
          >
            <input
              type="radio"
              name="space-mode"
              className="mt-1"
              checked={mode === 'spaces'}
              disabled={!pickerSpaces}
              onChange={() => setMode('spaces')}
            />
            <span className="flex flex-col">
              <span className="text-2 font-medium">
                {t('consent.spaces.explicit.title')}
              </span>
              <span className="text-1 text-neutral-11">
                {t('consent.spaces.explicit.detail')}
              </span>
            </span>
          </label>
          {mode === 'spaces' && pickerSpaces ? (
            <div className="flex flex-col gap-2 pl-6">
              {pickerSpaces.length === 0 ? (
                <p className="text-1 text-neutral-11">
                  {t('consent.spaces.none')}
                </p>
              ) : (
                <>
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('consent.spaces.filter')}
                    aria-label={t('consent.spaces.filter')}
                    className="border p-2 text-2"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-1">
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        setChosen(
                          new Set(
                            pickerSpaces
                              .slice(0, MAX_SPACE_GRANTS)
                              .map((x) => x.id),
                          ),
                        )
                      }
                    >
                      {t('consent.spaces.selectAll')}
                    </button>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setChosen(new Set())}
                    >
                      {t('consent.spaces.selectNone')}
                    </button>
                  </div>
                  {overLimit ? (
                    <p role="note" className="text-1 text-warning-11">
                      {t('consent.spaces.limit', { max: MAX_SPACE_GRANTS })}
                    </p>
                  ) : null}
                  <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                    {visibleSpaces.map((space) => (
                      <li key={space.id} className="flex items-start gap-3">
                        <Checkbox
                          id={`space-${space.id}`}
                          checked={chosen.has(space.id)}
                          onCheckedChange={(v) =>
                            toggleSpace(space.id, v === true)
                          }
                        />
                        <Avatar className="h-6 w-6">
                          {space.logoUrl ? (
                            <AvatarImage src={space.logoUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-1">
                            {(space.title || '?').slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <label htmlFor={`space-${space.id}`} className="text-2">
                          {space.title}{' '}
                          <span className="text-1 text-neutral-11">
                            {space.slug}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : null}
          {!pickerSpaces ? (
            <p role="note" className="text-1 text-neutral-11">
              {t('consent.spaces.unavailable')}
            </p>
          ) : null}
          <p className="text-1 text-neutral-11">{t('consent.spaces.note')}</p>
        </fieldset>
      ) : null}
      {error ? (
        <p role="alert" className="text-2">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          onClick={() => void submit(true)}
          disabled={busy || !hasRead || needsSpaces}
        >
          {t('consent.approve')}
        </Button>
        <Button
          variant="outline"
          onClick={() => void submit(false)}
          disabled={busy}
        >
          {t('consent.deny')}
        </Button>
      </div>
    </main>
  );
}
