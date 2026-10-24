'use client';

/** TEMP(#2575): button that sends a push to yourself with a chosen link. Remove with the fix. */
import { useState } from 'react';
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
