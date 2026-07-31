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
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const t = useTranslations('SelectCreateAction');
  const tSettings = useTranslations('SpaceSettingsAction');

  const CREATE_ACTIONS = [
    {
      defaultDurationDays: 3,
      title: t('actions.makeCollectiveAgreement.title'),
      description: t('actions.makeCollectiveAgreement.description'),
      href: 'agreements/create',
      icon: <FileText className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['space' as const],
    },
    {
      defaultDurationDays: 4,
      title: t('actions.proposeContribution.title'),
      description: t('actions.proposeContribution.description'),
      href: 'agreements/create/propose-contribution',
      icon: <Rocket className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['pay' as const, 'member' as const],
    },
    {
      defaultDurationDays: 4,
      title: tSettings('actions.redeemTokens.title'),
      description: tSettings('actions.redeemTokens.description'),
      href: 'agreements/create/redeem-tokens',
      icon: <Gift className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['mint' as const],
    },
    {
      defaultDurationDays: 7,
      title: t('actions.payExpenses.title'),
      description: t('actions.payExpenses.description'),
      href: 'agreements/create/pay-for-expenses',
      icon: <TrendingUp className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['pay' as const],
    },
    {
      defaultDurationDays: 7,
      title: t('actions.acceptInvestment.title'),
      description: t('actions.acceptInvestment.description'),
      href: 'agreements/create/accept-investment',
      icon: <PiggyBank className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['pay' as const],
    },
    {
      defaultDurationDays: 7,
      title: t('actions.exchangeStakesAndTokens.title'),
      description: t('actions.exchangeStakesAndTokens.description'),
      href: 'agreements/create/exchange-stakes-and-tokens',
      icon: <Package className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['pay' as const, 'mint' as const],
    },
    {
      defaultDurationDays: 7,
      title: t('actions.deployFunds.title'),
      description: t('actions.deployFunds.description'),
      href: 'agreements/create/deploy-funds',
      icon: <Workflow className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['pay' as const],
    },
    {
      defaultDurationDays: 7,
      title: t('actions.airdrop.title'),
      description: t('actions.airdrop.description'),
      href: 'agreements/create/airdrop',
      icon: <Send className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired || isMutateLoading || !canMutate,
      intents: ['pay' as const, 'mint' as const],
    },
    {
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <Wallet className="craft-icon" strokeWidth={1.5} />,
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address || isMutateLoading || !canMutate,
      intents: ['pay' as const],
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
