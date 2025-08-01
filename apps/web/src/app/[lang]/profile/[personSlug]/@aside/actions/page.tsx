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
import { useMemberBySlug } from '@web/hooks/use-member-by-slug';

const MIGRATE_HYPHA_TOKENS_URL = 'https://hypha-react-demo.vercel.app';

const WALLET_ACTIONS = [
  {
    title: 'Deposit Funds',
    description:
      'Add tokens to your personal wallet by copying your wallet address or scanning the QR code.',
    href: 'deposit-funds',
    icon: <PlusCircledIcon />,
  },
  {
    title: 'Transfer Funds (Coming soon)',
    description:
      'Send tokens from your personal wallet to a member, space, or custom address.',
    href: 'transfer-funds',
    icon: <Share1Icon />,
    disabled: true,
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
    title: 'Activate Space(s) (Coming Soon)',
    description:
      'Activate your Spaces by simply paying a Hypha Network Contribution with USDC or Hypha Tokens.',
    href: '#',
    icon: <ArrowRightIcon />,
    disabled: true,
  },
  {
    title: 'Migrate Hypha Tokens (Telos → Base)',
    description:
      'Move your Hypha tokens from the Telos blockchain to the Base network. Initiates the migration experience.',
    href: 'migrate-hypha-tokens',
    icon: <LoopIcon />,
    disabled: false,
    target: '_blank',
  },
];

export default function ProfileWallet() {
  const { lang, personSlug } = useParams();
  const { person } = useMemberBySlug(personSlug as string);
  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-end items-center">
          <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
        </div>
        <SelectAction
          title="Actions"
          content="Manage your personal funds, interact with the Hypha network, and contribute directly using your wallet."
          actions={WALLET_ACTIONS.map((action) => ({
            ...action,
            href:
              action.title === 'Migrate Hypha Tokens (Telos → Base)'
                ? `${MIGRATE_HYPHA_TOKENS_URL}/${person?.address}`
                : `/${lang}/profile/${personSlug}/actions/${action.href}`,
            target: action.target || undefined,
          }))}
        />
      </div>
    </SidePanel>
  );
}
