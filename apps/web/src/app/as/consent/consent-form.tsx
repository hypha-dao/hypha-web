'use client';

import * as React from 'react';
import { Button, Checkbox } from '@hypha-platform/ui';
import { AUTH_SERVER_API_BASE_PATH } from '@hypha-platform/auth-server/client';
import { setPopupClient } from '@web/components/popup-route-gate';

type Scope = { scope: string; title: string; detail: string };

export function ConsentForm({
  oauthQuery,
  personName,
  client,
  scopes,
}: {
  oauthQuery: string;
  personName: string;
  client: { name: string; host: string; redirectHost: string };
  scopes: Scope[];
}) {
  const [granted, setGranted] = React.useState<Set<string>>(
    () => new Set(scopes.map((s) => s.scope)),
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setPopupClient({ name: client.name, logoUrl: null });
    return () => setPopupClient(null);
  }, [client.name]);

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
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string };
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      setError('Something went wrong. Please start again from the app.');
    } catch {
      setError('Something went wrong. Please start again from the app.');
    }
    setBusy(false);
  };

  const hasRead = scopes.some(
    (s) => s.scope !== 'offline_access' && granted.has(s.scope),
  );

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-4 font-medium">Approve {client.name}?</h1>
      <p role="note" className="border border-warning-8 p-3 text-2">
        Hypha has not verified this app. It calls itself{' '}
        <strong>{client.name}</strong>
        {client.host ? (
          <>
            {' '}
            and identifies itself from <strong>{client.host}</strong>
          </>
        ) : null}
        . After you approve, you are sent back to{' '}
        <strong>{client.redirectHost}</strong>. Only approve apps you started
        yourself.
      </p>
      <p className="text-2 text-neutral-11">
        Signed in as {personName}. This app is asking to:
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
              <span className="text-2 font-medium">{s.title}</span>
              <span className="text-1 text-neutral-11">{s.detail}</span>
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
          Approve
        </Button>
        <Button
          variant="outline"
          onClick={() => void submit(false)}
          disabled={busy}
        >
          Deny
        </Button>
      </div>
    </main>
  );
}
