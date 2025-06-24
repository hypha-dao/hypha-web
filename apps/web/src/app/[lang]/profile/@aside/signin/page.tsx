'use client';

import { SidePanel, SigninPanel } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import React from 'react';

export default function SignupPage() {
  const { lang } = useParams();
  return (
    <SidePanel>
      <SigninPanel
        signinUrl=''
        signupUrl={`/${lang}/profile/signup/`}
        closeUrl={`/${lang}/profile/`}
        isLoading={false}
      />
    </SidePanel>
  );
}
