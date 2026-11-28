'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import {
  AUTH_SERVER_API_BASE_PATH,
  CONNECTED_APPS_DISCONNECT_PATH,
  CONNECTED_APPS_SPACES_PATH,
  type ClientKind,
  type ScopeCopyKey,
} from '@hypha-platform/auth-server/client';
import { SpacePicker, type PickerSpace } from '../_lib/space-picker';

export type AppView = {
  /** The person's consent record id: the only handle the page sends back. */
  id: string;
  name: string;
  kind: ClientKind;
  host: string;
  scopes: { scope: string; copyKey: ScopeCopyKey }[];
  reads: boolean;
  writes: boolean;
  spaces: 'all' | { id: number; title: string }[] | null;
  connectedOn: string;
  lastActiveOn: string | null;
  initialSpaces: {
    mode: 'all' | 'spaces';
    chosen: number[];
    keptUnlisted: boolean;
  };
};

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function ConnectedAppsList({
  personId,
  personName,
  apps: initialApps,
  pickerSpaces,
}: {
  personId: string;
  personName: string;
  apps: AppView[];
  pickerSpaces: PickerSpace[] | null;
}) {
  const t = useTranslations('AuthServer');
  const [apps, setApps] = React.useState(initialApps);
  const [notice, setNotice] = React.useState<Notice>(null);

  /** Never throws: a network failure is reported like any other failed action. */
  const post = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${AUTH_SERVER_API_BASE_PATH}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        credentials: 'same-origin',
        // The account this page showed: an action from another session is refused.
        body: JSON.stringify({ ...body, expected_person: personId }),
      });
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      return { ok: res.ok, error: parsed.error };
    } catch {
      return { ok: false };
    }
  };

  const failure = (error: string | undefined) =>
    error === 'account_changed'
      ? t('approval.accountChanged')
      : t('apps.failed');

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-12">
      <h1 className="text-4 font-medium">{t('apps.title')}</h1>
      <p className="text-2 text-neutral-11">{t('apps.intro')}</p>
      <p className="text-2 text-neutral-11">
        {t('consent.signedInAs', { name: personName })}
      </p>
      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className="text-2"
        >
          {notice.text}
        </p>
      ) : null}
      {apps.length === 0 ? (
        <p className="text-2">{t('apps.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              pickerSpaces={pickerSpaces}
              onSaveSpaces={async (value) => {
                setNotice(null);
                const r = await post(CONNECTED_APPS_SPACES_PATH, {
                  app: app.id,
                  space_grants: value,
                });
                if (!r.ok) {
                  setNotice({ kind: 'error', text: failure(r.error) });
                  return false;
                }
                const titles = new Map(
                  (pickerSpaces ?? []).map((s) => [s.id, s.title]),
                );
                setApps((prev) =>
                  prev.map((a) =>
                    a.id !== app.id
                      ? a
                      : {
                          ...a,
                          spaces:
                            value === 'all'
                              ? 'all'
                              : value.map((id) => ({
                                  id,
                                  title: titles.get(id) ?? String(id),
                                })),
                          initialSpaces: {
                            mode: value === 'all' ? 'all' : 'spaces',
                            chosen: value === 'all' ? [] : value,
                            // Spaces not loaded: the saved list stays selectable.
                            keptUnlisted: value !== 'all' && !pickerSpaces,
                          },
                        },
                  ),
                );
                setNotice({ kind: 'ok', text: t('apps.saved') });
                return true;
              }}
              onDisconnect={async () => {
                setNotice(null);
                const r = await post(CONNECTED_APPS_DISCONNECT_PATH, {
                  app: app.id,
                });
                if (!r.ok) {
                  setNotice({ kind: 'error', text: failure(r.error) });
                  return;
                }
                setApps((prev) => prev.filter((a) => a.id !== app.id));
                setNotice({
                  kind: 'ok',
                  text: t('apps.disconnected', { name: app.name }),
                });
              }}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function AppCard({
  app,
  pickerSpaces,
  onSaveSpaces,
  onDisconnect,
}: {
  app: AppView;
  pickerSpaces: PickerSpace[] | null;
  onSaveSpaces: (value: 'all' | number[]) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
}) {
  const t = useTranslations('AuthServer');
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState(app.initialSpaces.mode);
  const [chosen, setChosen] = React.useState(
    () => new Set(app.initialSpaces.chosen),
  );

  const startEditing = () => {
    setMode(app.initialSpaces.mode);
    setChosen(new Set(app.initialSpaces.chosen));
    setConfirming(false);
    setEditing(true);
  };

  const identity =
    app.kind === 'cimd'
      ? t('apps.kind.cimd', { host: app.host })
      : app.kind === 'registered'
      ? app.host
        ? t('apps.kind.registeredWithHost', { host: app.host })
        : t('apps.kind.registered')
      : t('apps.kind.dcr');

  return (
    <li className="flex flex-col gap-3 border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-3 font-medium break-all">{app.name}</h2>
        <p className="text-1 text-neutral-11 break-all">{identity}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-2 font-medium">{t('apps.mayDo')}</h3>
        <ul className="flex flex-col gap-1 text-2">
          {app.scopes.map((s) => (
            <li key={s.scope}>
              {s.copyKey === 'unknown'
                ? s.scope
                : t(`consent.scopes.${s.copyKey}.title`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-2 font-medium">{t('apps.spaces')}</h3>
        <p className="text-2">
          {!app.reads || app.spaces === null
            ? t('apps.spacesNone')
            : app.spaces === 'all'
            ? t('consent.spaces.all.title')
            : app.spaces.length === 0
            ? t('apps.spacesNone')
            : app.spaces.map((s) => s.title).join(', ')}
        </p>
      </div>
      <p className="text-1 text-neutral-11">
        {t('apps.connectedOn', { date: app.connectedOn })}
        {app.lastActiveOn
          ? ` · ${t('apps.lastActive', { date: app.lastActiveOn })}`
          : ''}
      </p>

      {editing ? (
        <div className="flex flex-col gap-3">
          <SpacePicker
            name={`spaces-${app.id}`}
            title={
              app.writes
                ? t('consent.spaces.titleWithWrite')
                : t('consent.spaces.title')
            }
            pickerSpaces={pickerSpaces}
            mode={mode}
            onModeChange={setMode}
            chosen={chosen}
            onChosenChange={setChosen}
            keptUnlisted={app.initialSpaces.keptUnlisted}
          />
          <p className="text-1 text-neutral-11">{t('apps.whenApplied')}</p>
          <div className="flex gap-2">
            <Button
              disabled={busy || (mode === 'spaces' && chosen.size === 0)}
              onClick={async () => {
                setBusy(true);
                try {
                  const saved = await onSaveSpaces(
                    mode === 'all' ? 'all' : [...chosen],
                  );
                  if (saved) setEditing(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('apps.save')}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              {t('apps.cancel')}
            </Button>
          </div>
        </div>
      ) : confirming ? (
        <div className="flex flex-col gap-3 border border-warning-8 p-3">
          <p className="text-2">
            {t('apps.confirmDisconnect', { name: app.name })}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDisconnect();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('apps.disconnect')}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {t('apps.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {app.reads ? (
            <Button variant="outline" onClick={startEditing}>
              {t('apps.changeSpaces')}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setConfirming(true)}>
            {t('apps.disconnect')}
          </Button>
        </div>
      )}
    </li>
  );
}
