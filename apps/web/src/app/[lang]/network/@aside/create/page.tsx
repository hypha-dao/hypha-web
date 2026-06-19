'use client';

import { getOnboardingPath } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NetworkCreateSpacePage() {
  const { lang } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(getOnboardingPath(lang as Locale));
  }, [lang, router]);

  return null;
}
