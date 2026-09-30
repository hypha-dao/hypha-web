'use client';

import { SignupFlow, type SignupFlowValues } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import { useCreateProfile } from '@web/hooks/use-create-profile';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function SignupPage() {
  const { createProfile, isCreating, error } = useCreateProfile();
  const { user, isLoading } = useAuthentication();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const flow = (
    <SignupFlow
      email={user?.email}
      walletAddress={isLoading ? undefined : user?.wallet?.address}
      isCreating={isCreating}
      error={error}
      onComplete={async (values: SignupFlowValues) => {
        await createProfile(values);
      }}
    />
  );

  if (!mounted) return flow;
  return createPortal(flow, document.body);
}
