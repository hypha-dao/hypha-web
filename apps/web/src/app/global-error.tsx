'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error] Unhandled root error', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-medium">Something went wrong.</h2>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
