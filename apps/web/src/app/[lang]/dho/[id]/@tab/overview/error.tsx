'use client'; // Error boundaries must be Client Components

import * as React from 'react';
import { ErrorComponent } from '@web/components/error';
import { useTranslations } from 'next-intl';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tCommon = useTranslations('Common');
  // TEMP(#2575)
  React.useEffect(() => {
    console.error('[#2575] overview error boundary', {
      message: error.message,
      digest: error.digest,
      href: window.location.href,
      referrer: document.referrer,
      stack: error.stack,
    });
  }, [error]);
  return (
    <ErrorComponent
      message={tCommon('errorLoadOverviewTab')}
      error={error}
      reset={reset}
    />
  );
}
