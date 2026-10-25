'use client';

/** TEMP(#2575): button that sends a push to yourself with a chosen link. Remove with the fix. */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuthentication } from '@hypha-platform/authentication';

export function DebugTestPush() {
  const { lang, id } = useParams<{ lang: string; id: string }>();
  const signal = useSearchParams().get('signal') ?? '<signal-slug>';
  const { getAccessToken } = useAuthentication();
  const base = `/${lang}/dho/${id}`;
  const [path, setPath] = useState(`${base}?signal=${signal}&msg=%24abc`);
  const [status, setStatus] = useState<string | null>(null);

  const presets: { label: string; value: string }[] = [
    {
      label: 'bare + signal (redirect)',
      value: `${base}?signal=${signal}&msg=%24abc`,
    },
    {
      label: 'coherence + signal',
      value: `${base}/coherence?signal=${signal}`,
    },
    { label: 'overview', value: `${base}/overview` },
  ];

  const [flags, setFlags] = useState<string[]>([]);
  useEffect(() => {
    const entry = document.cookie
      .split('; ')
      .find((item) => item.startsWith('exp2575='));
    setFlags(
      (entry?.slice('exp2575='.length) ?? '').split(',').filter(Boolean),
    );
  }, []);
  const toggleFlag = (flag: string) => {
    const next = flags.includes(flag)
      ? flags.filter((item) => item !== flag)
      : [...flags, flag];
    document.cookie = `exp2575=${next.join(
      ',',
    )}; path=/; max-age=86400; samesite=lax`;
    setFlags(next);
  };
  const experiments: { flag: string; label: string }[] = [
    {
      flag: 'http-redirect',
      label: 'X: bare space URL redirects over HTTP (middleware)',
    },
    {
      flag: 'keep-query',
      label: 'Y: bare space redirect keeps ?signal=&msg= (page and X)',
    },
    {
      flag: 'no-router-replace',
      label: 'Z: signal-URL sync uses history.replaceState only',
    },
  ];

  const send = async () => {
    setStatus('sending…');
    const token = await getAccessToken();
    const response = await fetch('/api/v1/debug/test-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ path }),
    });
    setStatus(`${response.status} ${(await response.text()).slice(0, 200)}`);
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-dashed p-3 text-1">
      <strong>#2575 test push (temporary)</strong>
      <div className="flex flex-col gap-1">
        <span>
          Experiments (apply on the next navigation; hard reload to be safe):
        </span>
        {experiments.map(({ flag, label }) => (
          <label key={flag} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={flags.includes(flag)}
              onChange={() => toggleFlag(flag)}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => setPath(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        className="rounded border px-2 py-1"
        value={path}
        onChange={(event) => setPath(event.target.value)}
      />
      <button
        type="button"
        className="self-start rounded border px-2 py-1"
        onClick={() => void send()}
      >
        Send push to me
      </button>
      {status ? <span>{status}</span> : null}
    </div>
  );
}
