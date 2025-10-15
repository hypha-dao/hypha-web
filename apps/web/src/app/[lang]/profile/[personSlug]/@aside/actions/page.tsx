'use client';

import React from 'react';
import {
  ButtonClose,
  ProfilePageParams,
  SelectAction,
  SidePanel,
} from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import {
  PlusCircledIcon,
  Share1Icon,
  ArrowLeftIcon,
  ArrowRightIcon,
  LoopIcon,
} from '@radix-ui/react-icons';
import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { useFundWallet } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

const MIGRATE_HYPHA_TOKENS_URL = 'https://hypha-react-demo.vercel.app';

export default function ProfileWallet() {
  const { lang, personSlug: personSlugRaw } = useParams<ProfilePageParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person } = useMemberBySlug(personSlug);
  const { fundWallet } = useFundWallet({ address: person?.address });

  const WALLET_ACTIONS = [
    {
      title: 'Deposit Funds',
      description:
        'Add tokens to your personal wallet by copying your wallet address or scanning the QR code.',
      icon: <PlusCircledIcon />,
      onAction: () => {
        fundWallet();
      },
    },
    {
      title: 'Transfer Funds',
      description:
        'Send tokens from your personal wallet to a member, space, or custom address.',
      href: 'transfer-funds',
      icon: <Share1Icon />,
    },
    {
      title: 'Buy Hypha Tokens (Rewards)',
      description:
        'Purchase Hypha tokens to participate in the network and earn rewards',
      href: 'purchase-hypha-tokens',
      icon: <ArrowLeftIcon />,
    },
    {
      title: 'Activate Space(s)',
      description:
        'Sponsor and activate your favourite space(s) by contributing HYPHA or USDC, supporting the Hypha Network.',
      href: 'activate-spaces',
      icon: <ArrowRightIcon />,
    },
    {
      title: 'Migrate Hypha Tokens (Telos → Base)',
      description:
        'Move your Hypha tokens from the Telos blockchain to the Base network. Initiates the migration experience.',
      href: 'migrate-hypha-tokens',
      icon: <LoopIcon />,
      disabled: !person?.address,
      target: '_blank',
    },
  ];

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
