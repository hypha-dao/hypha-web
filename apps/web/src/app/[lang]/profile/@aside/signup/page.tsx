'use client';

import { SidePanel, SignupPanel } from '@hypha-platform/epics';
import React, { useEffect, useState } from 'react';
import { useCreateProfile } from '@web/hooks/use-create-profile';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';
import { LoadingBackdrop } from '@hypha-platform/ui';

export default function SignupPage() {
  const { createProfile, isCreating, error } = useCreateProfile();
  const { user, isLoading } = useAuthentication();
  const { lang } = useParams();
  const [walletAddress, setWalletAddress] = useState<string | undefined>(
    user?.wallet?.address,
  );

  useEffect(() => {
    if (user?.wallet?.address) {
      setWalletAddress(user.wallet.address);
    }
  }, [user?.wallet?.address]);

  const handleSave = async (values: any) => {
    try {
      if (!walletAddress) {
        throw new Error(
          'Wallet address is required. Please connect your wallet first.',
        );
      }
      await createProfile({
        ...values,
        address: walletAddress,
      });
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  };

  return (
    <LoadingBackdrop
      showKeepWindowOpenMessage={true}
      isLoading={isLoading || !user?.wallet?.address}
      message={<span>Loading...</span>}
    >
      <>
        <div
          style={{ backdropFilter: 'blur(3px)' }}
          className="fixed inset-0 z-40"
        />
        <SidePanel className="z-50">
          <SignupPanel
            closeUrl={`/${lang}/profile`}
            onSave={handleSave}
            isCreating={isCreating}
            error={error}
          />
        </SidePanel>
      </>
    </LoadingBackdrop>
  );
}
