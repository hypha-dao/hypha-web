'use client';

import { SidePanel, SigninPanel } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe } from '@core/people';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const { lang } = useParams();
  const { login, isAuthenticated } = useAuthentication();
  const { person, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      if (person?.id) {
        router.push(`/${lang}/my-spaces`);
      } else {
        router.push(`/${lang}/profile/signup`);
      }
    }
  }, [isAuthenticated, isLoading, person, router, lang]);

  return (
    <SidePanel>
      <SigninPanel
        onLogin={login}
        closeUrl={`/${lang}/profile/`}
        isLoading={false}
      />
    </SidePanel>
  );
}
