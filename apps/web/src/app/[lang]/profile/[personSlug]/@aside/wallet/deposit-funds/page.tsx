'use client';

import { SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { ButtonClose, ButtonBack } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { PersonDepositFunds } from '@hypha-platform/epics';
import { useMemberBySlug } from '@web/hooks/use-member-by-slug';

export default function ProfileWalletDepositFunds() {
  const { lang, personSlug } = useParams();
  const { person } = useMemberBySlug(personSlug as string);
  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="flex text-4 text-secondary-foreground justify-start items-center">
            Deposit Funds
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label="Back to wallet"
              backUrl={`/${lang}/profile/${personSlug}/wallet`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <PersonDepositFunds personAddress={person?.address as `0x${string}`} />
      </div>
    </SidePanel>
  );
}
