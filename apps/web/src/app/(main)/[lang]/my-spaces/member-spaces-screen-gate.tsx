'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@hypha-platform/core/client';

/**
 * Members do not get the spaces listing. Other personas keep the screen,
 * including while the profile is still loading.
 */
export function MemberSpacesScreenGate({
  lang,
  children,
}: {
  lang: string;
  children: ReactNode;
}) {
  const { person, isLoading } = useMe();
  const router = useRouter();
  const blocked = !isLoading && person?.primaryOrientation === 'member';

  useEffect(() => {
    if (blocked) router.replace(`/${lang}/home`);
  }, [blocked, lang, router]);

  if (blocked) return null;
  return children;
}
