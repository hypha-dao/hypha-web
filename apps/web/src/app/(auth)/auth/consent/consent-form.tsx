'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox } from '@hypha-platform/ui';
import {
  AUTH_SERVER_API_BASE_PATH,
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

export function ConsentForm({
  oauthQuery,
  personId,
  personName,
  client,
  scopes,
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
}) {
  const t = useTranslations('AuthServer');
  const [granted, setGranted] = React.useState<Set<string>>(
    () => new Set(scopes.filter((s) => s.defaultGranted).map((s) => s.scope)),
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const toggle = (scope: string, on: boolean) =>
    setGranted((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
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
      {error ? (
        <p role="alert" className="text-2">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={() => void submit(true)} disabled={busy || !hasRead}>
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
