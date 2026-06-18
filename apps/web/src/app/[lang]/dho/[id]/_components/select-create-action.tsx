'use client';

import {
  SelectAction,
  useActionGating,
  useCanMutateInSpace,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import {
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
  const { canMutate, isLoading: isMutateLoading } = useCanMutateInSpace({
    spaceSlug: daoSlug,
    space,
    spaceId: space?.web3SpaceId,
  });
  const t = useTranslations('SelectCreateAction');
  const tSettings = useTranslations('SpaceSettingsAction');

  const CREATE_ACTIONS = [
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
