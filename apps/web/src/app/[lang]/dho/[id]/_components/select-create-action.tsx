'use client';

import { SelectAction, useActionGating } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import {
  FileText,
  Landmark,
  Package,
  PiggyBank,
  Rocket,
  TrendingUp,
  Wallet,
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
  const t = useTranslations('SelectCreateAction');

  const CREATE_ACTIONS = [
    {
      defaultDurationDays: 3,
      title: t('actions.makeCollectiveAgreement.title'),
      description: t('actions.makeCollectiveAgreement.description'),
      href: 'agreements/create',
      icon: <FileText className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      title: t('actions.proposeContribution.title'),
      description: t('actions.proposeContribution.description'),
      href: 'agreements/create/propose-contribution',
      icon: <Rocket className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.payExpenses.title'),
      description: t('actions.payExpenses.description'),
      href: 'agreements/create/pay-for-expenses',
      icon: <TrendingUp className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.acceptInvestmentComingSoon.title'),
      description: t('actions.acceptInvestmentComingSoon.description'),
      href: '#',
      icon: <PiggyBank className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: true,
      comingSoon: true,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.exchangeOwnershipComingSoon.title'),
      description: t('actions.exchangeOwnershipComingSoon.description'),
      href: '#',
      icon: <Package className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: true,
      comingSoon: true,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.deployFunds.title'),
      description: t('actions.deployFunds.description'),
      href: 'agreements/create/deploy-funds',
      icon: <Landmark className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <Wallet className="size-[22px] shrink-0" strokeWidth={1.75} />,
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address,
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
