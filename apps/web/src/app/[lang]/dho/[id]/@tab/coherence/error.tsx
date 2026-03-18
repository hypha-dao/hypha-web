'use client';

import { ErrorComponent } from '@web/components/error';
import { useTranslations } from 'next-intl';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('CoherenceTab');
  return (
    <ErrorComponent
      message={t('errorCoherenceTab')}
      error={error}
      reset={reset}
    />
  );
}
