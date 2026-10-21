'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button } from '@hypha-platform/ui';
import {
  DeveloperClient,
  SCOPE_LABELS,
  readApiError,
  useDeveloperApi,
} from '../_lib/api';
import { KeyReveal } from './key-reveal';

const STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  revoked: 'Revoked',
} as const;

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';

function ClientCard({
  client,
  actions,
}: {
  client: DeveloperClient;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 border border-border p-4">
      <div className="flex items-center gap-3">
        {/* The owner only gets an approved logo; a reviewer also gets the pending one. */}
        {client.logo.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.logo.url}
            alt={client.name}
            width={40}
            height={40}
            className="size-10 shrink-0 object-contain"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-3 font-semibold text-foreground">
            {client.name}{' '}
            <span className="text-1 font-normal text-muted-foreground">
              ({client.slug})
            </span>
          </p>
          {client.description && (
            <p className="text-2 text-muted-foreground">{client.description}</p>
          )}
        </div>
        <Badge>{STATUS_LABEL[client.status]}</Badge>
      </div>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-2">
        <dt className="text-muted-foreground">Scopes</dt>
        <dd>
          {client.scopes.map((scope) => (
            <code key={scope} title={SCOPE_LABELS[scope]} className="mr-2">
              {scope}
            </code>
          ))}
        </dd>
        <dt className="text-muted-foreground">Origins</dt>
        <dd className="break-all">
          {client.allowedOrigins.length
            ? client.allowedOrigins.join(', ')
            : 'none'}
        </dd>
        {client.keyPrefix && (
          <>
            <dt className="text-muted-foreground">Key</dt>
            <dd>
              <code>{client.keyPrefix}…</code>
            </dd>
          </>
        )}
        {client.contactEmail && (
          <>
            <dt className="text-muted-foreground">Contact</dt>
            <dd>{client.contactEmail}</dd>
          </>
        )}
        {client.logo.state !== 'none' && (
          <>
            <dt className="text-muted-foreground">Logo</dt>
            <dd>
              {client.logo.state === 'approved'
                ? 'Approved'
                : 'In review (not shown yet)'}
            </dd>
          </>
        )}
      </dl>
      {actions}
    </li>
  );
}

/** The signed-in user's clients, plus the review step when they are a reviewer. */
export function ClientList() {
  const { lang } = useParams<{ lang: string }>();
  const api = useDeveloperApi();
  const [mine, setMine] = useState<DeveloperClient[] | null>(null);
  const [reviewer, setReviewer] = useState(false);
  const [queue, setQueue] = useState<DeveloperClient[]>([]);
  const [revealed, setRevealed] = useState<{ name: string; key: string }>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api('/users/me/clients');
      if (!res.ok) return setError(await readApiError(res));
      const body = (await res.json()) as {
        items: DeveloperClient[];
        reviewer: boolean;
      };
      setMine(body.items);
      setReviewer(body.reviewer);
      if (body.reviewer) {
        const all = await api('/reviewer/clients');
        if (all.ok) {
          setQueue(((await all.json()) as { items: DeveloperClient[] }).items);
        }
      }
      setError(null);
    } catch {
      setError('Could not reach the server.');
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (
    client: DeveloperClient,
    action: 'approve' | 'revoke' | 'rotate-key',
  ) => {
    setBusy(true);
    try {
      const res = await api(
        `/reviewer/clients/${encodeURIComponent(client.slug)}/${action}`,
        { method: 'POST' },
      );
      if (!res.ok) return setError(await readApiError(res));
      const body = (await res.json()) as { clientKey?: string };
      if (body.clientKey) {
        setRevealed({ name: client.name, key: body.clientKey });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (client: DeveloperClient, file?: File) => {
    if (!file) return;
    const body = new FormData();
    body.set('logo', file);
    const res = await api(
      `/users/me/clients/${encodeURIComponent(client.slug)}/logo`,
      { method: 'POST', body },
    );
    if (!res.ok) setError(await readApiError(res));
    else await load();
  };

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="text-2 text-destructive">
          {error}
        </p>
      )}
      {revealed && (
        <KeyReveal
          clientName={revealed.name}
          clientKey={revealed.key}
          onClose={() => setRevealed(undefined)}
        />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-4 font-semibold text-foreground">My clients</h2>
          <Link href={`/${lang}/developers/clients/new`}>
            <Button>Register a client</Button>
          </Link>
        </div>
        {mine === null && !error && (
          <p className="text-2 text-muted-foreground">Loading…</p>
        )}
        {mine?.length === 0 && (
          <p className="text-2 text-muted-foreground">
            You have not registered a client yet.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {mine?.map((client) => (
            <ClientCard
              key={client.slug}
              client={client}
              actions={
                client.status === 'pending' && (
                  <label className="text-1 text-muted-foreground">
                    {client.logo.state === 'none'
                      ? 'Add a logo'
                      : 'Replace the logo'}{' '}
                    (reviewed before it appears):{' '}
                    <input
                      type="file"
                      accept={LOGO_ACCEPT}
                      onChange={(e) =>
                        void uploadLogo(client, e.target.files?.[0])
                      }
                    />
                  </label>
                )
              }
            />
          ))}
        </ul>
      </section>

      {reviewer && (
        <section className="flex flex-col gap-3">
          <h2 className="text-4 font-semibold text-foreground">
            Review requests
          </h2>
          <p className="text-2 text-muted-foreground">
            Approving a client also approves its logo. The key appears once,
            here; pass it to the integrator securely. It is not stored.
          </p>
          <ul className="flex flex-col gap-3">
            {queue.map((client) => (
              <ClientCard
                key={client.slug}
                client={client}
                actions={
                  client.status !== 'revoked' && (
                    <div className="flex gap-2">
                      {client.status === 'pending' && (
                        <Button
                          disabled={busy}
                          onClick={() => void review(client, 'approve')}
                        >
                          Approve
                        </Button>
                      )}
                      {client.status === 'approved' && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => void review(client, 'rotate-key')}
                        >
                          Rotate key
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void review(client, 'revoke')}
                      >
                        {client.status === 'pending' ? 'Reject' : 'Revoke'}
                      </Button>
                    </div>
                  )
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
