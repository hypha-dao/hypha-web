'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox } from '@hypha-platform/ui';
import {
  AUTH_SERVER_API_BASE_PATH,
  SCOPES_REQUIRING_SPACES_READ,
  describeClient,
  type ClientKind,
  type ScopeCopyKey,
} from '@hypha-platform/auth-server/client';
import { SpacePicker, type PickerSpace } from '../_lib/space-picker';

type Scope = {
  scope: string;
  copyKey: ScopeCopyKey;
  defaultGranted: boolean;
  warn: boolean;
};

/** Scopes that act in the spaces chosen under `spaces:read`: only offered while it is ticked. */
const needsSpacesRead = (scope: string) =>
  (SCOPES_REQUIRING_SPACES_READ as readonly string[]).includes(scope);

export function ConsentForm({
  oauthQuery,
  personId,
  personName,
  client,
  scopes,
  pickerSpaces,
  initialSpaces,
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
  /**
   * Where the picker starts (`initialSpaceChoice`): "all" for a new connection, the stored list for
   * an app that is already connected. `keptUnlisted`: the stored list is kept although the spaces
   * could not be loaded, so an approval does not widen it to "all".
   */
  initialSpaces: {
    mode: 'all' | 'spaces';
    chosen: number[];
    keptUnlisted: boolean;
  };
}) {
  const t = useTranslations('AuthServer');
  const [granted, setGranted] = React.useState<Set<string>>(
    () => new Set(scopes.filter((s) => s.defaultGranted).map((s) => s.scope)),
  );
  // Which spaces the app may read. "All" is a separate choice that also covers spaces joined later
  // (it is not "tick everything"). A connected app starts on what it has now.
  const [mode, setMode] = React.useState<'spaces' | 'all'>(initialSpaces.mode);
  const [chosen, setChosen] = React.useState<Set<number>>(
    () => new Set(initialSpaces.chosen),
  );
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
        <SpacePicker
          name="space-mode"
          title={
            [...granted].some(needsSpacesRead)
              ? t('consent.spaces.titleWithWrite')
              : t('consent.spaces.title')
          }
          pickerSpaces={pickerSpaces}
          mode={mode}
          onModeChange={setMode}
          chosen={chosen}
          onChosenChange={setChosen}
          keptUnlisted={initialSpaces.keptUnlisted}
        />
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
