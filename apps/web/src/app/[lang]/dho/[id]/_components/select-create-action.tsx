'use client';

import {
  SelectAction,
  useActionGating,
  useCanMutateInSpace,
  useSpaceEnergy,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import {
  Bolt,
  FileText,
  Gift,
  Package,
  PiggyBank,
  Rocket,
  Send,
  TrendingUp,
  Wallet,
  Workflow,
} from 'lucide-react';

type SelectCreateActionProps = {
  daoSlug: string;
  lang: Locale;
  children?: React.ReactNode;
};

export const SelectCreateAction = ({
  daoSlug,
  lang,
  children,
}: SelectCreateActionProps) => {
  const { isPaymentExpired, fundWallet, space } = useActionGating(daoSlug);
  const { data: spaceEnergy } = useSpaceEnergy();
  const { canMutate, isLoading: isMutateLoading } = useCanMutateInSpace({
    spaceSlug: daoSlug,
    space,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const t = useTranslations('SelectCreateAction');
  const tSettings = useTranslations('SpaceSettingsAction');
  const isEnergyCommunity = spaceEnergy?.enabled === true;

  const CREATE_ACTIONS = [
    ...(!isEnergyCommunity
      ? [
          {
            defaultDurationDays: 5,
            title: 'Enable Energy Community',
            description:
              'Deploy an EnergyPPAv2 community via factory deployCommunity to activate energy features for this space.',
            href: 'agreements/create/enable-energy-community',
            icon: <Bolt className="size-[22px] shrink-0" strokeWidth={1.75} />,
            disabled: isPaymentExpired,
          },
        ]
      : []),
    ...(isEnergyCommunity
      ? [
          {
            defaultDurationDays: 5,
            title: 'Energy Sharing Proposal',
            description:
              'Define or update how this community shares and settles energy balances.',
            href: 'agreements/create/energy-sharing',
            icon: <Bolt className="size-[22px] shrink-0" strokeWidth={1.75} />,
            disabled: isPaymentExpired,
          },
          {
            defaultDurationDays: 5,
            title: 'Register Energy Source',
            description:
              'Propose onboarding a new source (solar, battery, etc.) into the energy mix.',
            href: 'agreements/create/register-energy-source',
            icon: <Bolt className="size-[22px] shrink-0" strokeWidth={1.75} />,
            disabled: isPaymentExpired,
          },
          {
            defaultDurationDays: 5,
            title: 'Add Energy Member',
            description:
              'Propose adding a member with device mapping for energy accounting.',
            href: 'agreements/create/add-energy-member',
            icon: <Bolt className="size-[22px] shrink-0" strokeWidth={1.75} />,
            disabled: isPaymentExpired,
          },
          {
            defaultDurationDays: 5,
            title: 'Change Energy Optimization',
            description:
              'Re-rank the community optimisation objectives and update social allocation on-chain.',
            href: 'agreements/create/change-energy-optimization',
            icon: <Bolt className="size-[22px] shrink-0" strokeWidth={1.75} />,
            disabled: isPaymentExpired,
          },
        ]
      : []),
    {
      defaultDurationDays: 3,
      title: t('actions.makeCollectiveAgreement.title'),
      description: t('actions.makeCollectiveAgreement.description'),
      href: 'agreements/create',
      icon: <FileText className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      defaultDurationDays: 4,
      title: t('actions.proposeContribution.title'),
      description: t('actions.proposeContribution.description'),
      href: 'agreements/create/propose-contribution',
      icon: <Rocket className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      defaultDurationDays: 4,
      title: tSettings('actions.redeemTokens.title'),
      description: tSettings('actions.redeemTokens.description'),
      href: 'agreements/create/redeem-tokens',
      icon: <Gift className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.payExpenses.title'),
      description: t('actions.payExpenses.description'),
      href: 'agreements/create/pay-for-expenses',
      icon: <TrendingUp className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.acceptInvestment.title'),
      description: t('actions.acceptInvestment.description'),
      href: 'agreements/create/accept-investment',
      icon: <PiggyBank className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.exchangeStakesAndTokens.title'),
      description: t('actions.exchangeStakesAndTokens.description'),
      href: 'agreements/create/exchange-stakes-and-tokens',
      icon: <Package className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.deployFunds.title'),
      description: t('actions.deployFunds.description'),
      href: 'agreements/create/deploy-funds',
      icon: <Workflow className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.airdrop.title'),
      description: t('actions.airdrop.description'),
      href: 'agreements/create/airdrop',
      icon: <Send className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
    },
    {
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <Wallet className="size-[22px] shrink-0" strokeWidth={1.75} />,
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address || isMutateLoading || !canMutate,
    },
  ];
  return (
    <SelectAction
      title={t('title')}
      content={t('content')}
      showTitle={false}
      actions={CREATE_ACTIONS.map((action) => ({
        ...action,
        ...(action.href && {
          href: `/${lang}/dho/${daoSlug}/${action.href}`,
        }),
      }))}
    >
      {children}
    </SelectAction>
  );
};
