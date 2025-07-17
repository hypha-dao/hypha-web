'use client';

import { SidePanel } from '@hypha-platform/epics';
import React from 'react';
import { ButtonClose } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { SelectAction } from '@hypha-platform/epics';
import {
  PlusCircledIcon,
  Share1Icon,
  ArrowLeftIcon,
  ArrowRightIcon,
  LoopIcon,
} from '@radix-ui/react-icons';

export const WALLET_ACTIONS = [
  {
    title: 'Deposit Funds',
    description:
      'Add tokens to your personal wallet by copying your wallet address or scanning the QR code.',
    href: 'deposit-funds',
    icon: <PlusCircledIcon />,
  },
  {
    title: 'Transfer Funds',
    description:
      'Send tokens from your personal wallet to a member, space, or custom address.',
    href: 'transfer-funds',
    icon: <Share1Icon />,
  },
  {
    title: 'Buy Hypha Tokens (Rewards) (Coming Soon)',
    description:
      'Purchase Hypha tokens to participate in the network and earn rewards',
    href: '#',
    icon: <ArrowLeftIcon />,
    disabled: true,
  },
  {
    title: 'Pay in Hypha Tokens (Hypha Network Contribution) (Coming Soon)',
    description:
      'Contribute to Hypha Network spaces by paying for participation in the Hypha Network using Hypha or USDC.',
    href: '#',
    icon: <ArrowRightIcon />,
    disabled: true,
  },
  {
    title: 'Migrate Hypha Tokens (Telos → Base)',
    description:
      'Move your Hypha tokens from the Telos blockchain to the Base network. Initiates the migration experience.',
    href: '#',
    icon: <LoopIcon />,
    disabled: true,
  },
];

export default function ProfileWallet() {
  const { lang } = useParams();
  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-end items-center">
          <ButtonClose closeUrl={`/${lang}/profile`} />
        </div>
        <SelectAction
          title="Wallet"
          content="Manage your personal funds, interact with the Hypha network, and contribute directly using your wallet."
          actions={WALLET_ACTIONS.map((action) => ({
            ...action,
            href: `/${lang}/profile/wallet/${action.href}`,
          }))}
        />
      </div>
    </SidePanel>
  );
}
