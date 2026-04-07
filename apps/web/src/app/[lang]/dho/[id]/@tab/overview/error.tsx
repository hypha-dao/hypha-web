'use client'; // Error boundaries must be Client Components

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
  return (
    <ErrorComponent
      message={tCommon('errorLoadOverviewTab')}
      error={error}
      reset={reset}
    />
  );
}
