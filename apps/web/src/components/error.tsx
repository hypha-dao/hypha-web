import { Button } from '@hypha-platform/ui';
import React from 'react';

export function ErrorComponent({
  message,
  error,
  reset,
}: {
  message: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      <h2>{message}</h2>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
