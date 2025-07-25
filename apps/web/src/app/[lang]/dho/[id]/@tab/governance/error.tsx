'use client'; // Error boundaries must be Client Components

import { Error } from '@web/components/error';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Error
      message="Oops, something went wrong. Couldn't load governance tab."
      error={error}
      reset={reset}
    />
  );
}
