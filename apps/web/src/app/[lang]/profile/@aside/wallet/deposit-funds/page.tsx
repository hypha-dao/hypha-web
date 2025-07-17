'use client';

import { SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { ButtonClose } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { PersonDepositFunds } from '@hypha-platform/epics';

export default function ProfileWalletDepositFunds() {
  const { lang } = useParams();
  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-end items-center">
          <ButtonClose closeUrl={`/${lang}/profile`} />
        </div>
        <PersonDepositFunds />
      </div>
    </SidePanel>
  );
}
