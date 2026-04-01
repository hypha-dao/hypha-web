'use client'; // Error boundaries must be Client Components

import { ErrorComponent } from '@web/components/error';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorComponent
      message="Oops, something went wrong. Couldn't load coherence tab."
      error={error}
      reset={reset}
    />
  );
}
