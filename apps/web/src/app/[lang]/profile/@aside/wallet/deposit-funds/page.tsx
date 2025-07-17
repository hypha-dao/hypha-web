'use client';

import { SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { ButtonClose, ButtonBack } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { PersonDepositFunds } from '@hypha-platform/epics';
import { useMe } from '@hypha-platform/core/client';

export default function ProfileWalletDepositFunds() {
  const { lang } = useParams();
  const { person } = useMe();
  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-end items-center">
          <ButtonBack
            label="Back to wallet"
            backUrl={`/${lang}/profile/wallet`}
          />
          <ButtonClose closeUrl={`/${lang}/profile`} />
        </div>
        <PersonDepositFunds personAddress={person?.address as `0x${string}`} />
      </div>
    </SidePanel>
  );
}
