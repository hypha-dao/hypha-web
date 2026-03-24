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
  ArrowUpIcon,
  LoopIcon,
} from '@radix-ui/react-icons';
import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { useFundWallet } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

const MIGRATE_HYPHA_TOKENS_URL = 'https://hypha-react-demo.vercel.app';

export default function ProfileWallet() {
  const tProfile = useTranslations('Profile');
  const tActions = useTranslations('ProfileActions');
  const { lang, personSlug: personSlugRaw } = useParams<ProfilePageParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person } = useMemberBySlug(personSlug);
  const { fundWallet } = useFundWallet({ address: person?.address });

  const WALLET_ACTIONS = [
    {
      id: 'depositFunds',
      title: tActions('actions.depositFunds.title'),
      description: tActions('actions.depositFunds.description'),
      icon: <PlusCircledIcon />,
      onAction: () => {
        fundWallet();
      },
    },
    {
      id: 'transferFunds',
      title: tActions('actions.transferFunds.title'),
      description: tActions('actions.transferFunds.description'),
      href: 'transfer-funds',
      icon: <Share1Icon />,
    },
    {
      id: 'redeemTokens',
      title: 'Redeem Tokens',
      description:
        'Convert your tokens into their equivalent fiat value held in the vault.',
      href: 'redeem-tokens',
      icon: <ArrowUpIcon />,
    },
    {
      title: 'Buy Hypha Tokens (Rewards)',
      description:
        'Convert your tokens into their equivalent fiat value held in the vault.',
      href: 'redeem-tokens',
      icon: <ArrowUpIcon />,
    },
    {
      id: 'buyHyphaTokensRewards',
      title: tActions('actions.buyHyphaTokensRewards.title'),
      description: tActions('actions.buyHyphaTokensRewards.description'),
      href: 'purchase-hypha-tokens',
      icon: <ArrowLeftIcon />,
    },
    {
      id: 'activateSpaces',
      title: tActions('actions.activateSpaces.title'),
      description: tActions('actions.activateSpaces.description'),
      href: 'activate-spaces',
      icon: <ArrowRightIcon />,
    },
    {
      id: 'migrateHyphaTokens',
      title: tActions('actions.migrateHyphaTokens.title'),
      description: tActions('actions.migrateHyphaTokens.description'),
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
          title={tProfile('actions')}
          content={tActions('content')}
          actions={WALLET_ACTIONS.map((action) => ({
            ...action,
            href:
              action.id === 'migrateHyphaTokens'
                ? `${MIGRATE_HYPHA_TOKENS_URL}/${person?.address ?? ''}`
                : action.href
                ? `/${lang}/profile/${personSlug}/actions/${action.href}`
                : undefined,
            target: action.target || undefined,
          }))}
        />
      </div>
    </SidePanel>
  );
}
