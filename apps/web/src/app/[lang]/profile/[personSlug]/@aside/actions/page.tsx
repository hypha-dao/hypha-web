'use client';

import React from 'react';
import {
  ModalStickyNavigation,
  ProfilePageParams,
  SelectAction,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import {
  ArrowLeftRight,
  CloudLightning,
  Gift,
  HandCoins,
  Rocket,
  Send,
  Sparkles,
} from 'lucide-react';
import { useMemberBySlug } from '@web/hooks/use-member-by-slug';
import { useFundWallet } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

const MIGRATE_HYPHA_TOKENS_URL = 'https://hypha-react-demo.vercel.app';

export default function ProfileWallet() {
  const tProfile = useTranslations('Profile');
  const tActions = useTranslations('ProfileActions');
  const tModalAside = useTranslations('ModalAside');
  const { lang, personSlug: personSlugRaw } = useParams<ProfilePageParams>();
  const personSlug = tryDecodeUriPart(personSlugRaw);
  const { person } = useMemberBySlug(personSlug);
  const { fundWallet } = useFundWallet({ address: person?.address });

  const WALLET_ACTIONS = [
    {
      id: 'depositFunds',
      title: tActions('actions.depositFunds.title'),
      description: tActions('actions.depositFunds.description'),
      icon: <HandCoins className="size-[22px] shrink-0" strokeWidth={1.75} />,
      onAction: () => {
        fundWallet();
      },
    },
    {
      id: 'transferFunds',
      title: tActions('actions.transferFunds.title'),
      description: tActions('actions.transferFunds.description'),
      href: 'transfer-funds',
      icon: <Send className="size-[22px] shrink-0" strokeWidth={1.75} />,
    },
    {
      id: 'redeemTokens',
      title: tActions('actions.redeemTokens.title'),
      description: tActions('actions.redeemTokens.description'),
      href: 'redeem-tokens',
      icon: <Gift className="size-[22px] shrink-0" strokeWidth={1.75} />,
    },
    {
      id: 'buyHyphaTokensRewards',
      title: tActions('actions.buyHyphaTokensRewards.title'),
      description: tActions('actions.buyHyphaTokensRewards.description'),
      href: 'purchase-hypha-tokens',
      icon: <Sparkles className="size-[22px] shrink-0" strokeWidth={1.75} />,
    },
    {
      id: 'buySpaceTokens',
      title: tActions('actions.buySpaceTokens.title'),
      description: tActions('actions.buySpaceTokens.description'),
      href: 'buy-space-tokens',
      icon: (
        <CloudLightning className="size-[22px] shrink-0" strokeWidth={1.75} />
      ),
    },
    {
      id: 'activateSpaces',
      title: tActions('actions.activateSpaces.title'),
      description: tActions('actions.activateSpaces.description'),
      href: 'activate-spaces',
      icon: <Rocket className="size-[22px] shrink-0" strokeWidth={1.75} />,
    },
    {
      id: 'migrateHyphaTokens',
      title: tActions('actions.migrateHyphaTokens.title'),
      description: tActions('actions.migrateHyphaTokens.description'),
      href: 'migrate-hypha-tokens',
      icon: (
        <ArrowLeftRight className="size-[22px] shrink-0" strokeWidth={1.75} />
      ),
      disabled: !person?.address,
      target: '_blank',
    },
  ];

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('profileActions')}
          closeUrl={`/${lang}/profile/${personSlug}`}
          backToParent
        />
        <SelectAction
          title={tProfile('actions')}
          content={tActions('content')}
          showTitle={false}
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
    </ProposalOverlayShell>
  );
}
