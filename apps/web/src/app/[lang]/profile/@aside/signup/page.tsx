'use client';

import { SidePanel, SignupPanel } from '@hypha-platform/epics';
import React, { useEffect, useState } from 'react';
import { useCreateProfile } from '@web/hooks/use-create-profile';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams } from 'next/navigation';

export default function SignupPage() {
  const { createProfile, isCreating } = useCreateProfile();
  const { user } = useAuthentication();
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
    <SidePanel>
      <SignupPanel
        closeUrl={`/${lang}/profile/`}
        onSave={handleSave}
        walletAddress={walletAddress}
        isCreating={isCreating}
      />
    </SidePanel>
  );
}
