'use client';

import { SelectAction, useActionGating } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  FileIcon,
  PlusCircledIcon,
  RocketIcon,
  Share1Icon,
} from '@radix-ui/react-icons';

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
      icon: <FileIcon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      title: t('actions.proposeContribution.title'),
      description: t('actions.proposeContribution.description'),
      href: 'agreements/create/propose-contribution',
      icon: <RocketIcon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.payExpenses.title'),
      description: t('actions.payExpenses.description'),
      href: 'agreements/create/pay-for-expenses',
      icon: <ArrowUpIcon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.acceptInvestmentComingSoon.title'),
      description: t('actions.acceptInvestmentComingSoon.description'),
      href: '#',
      icon: <PlusCircledIcon />,
      disabled: true,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.exchangeOwnershipComingSoon.title'),
      description: t('actions.exchangeOwnershipComingSoon.description'),
      href: '#',
      icon: <PlusCircledIcon />,
      disabled: true,
    },
    {
      defaultDurationDays: 7,
      title: t('actions.deployFunds.title'),
      description: t('actions.deployFunds.description'),
      href: 'agreements/create/deploy-funds',
      icon: <Share1Icon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 7,
      title: 'Redeem Tokens',
      description:
        'Convert tokens in the treasury into their equivalent fiat value held in the Space Token Issuer vault.',
      href: 'agreements/create/redeem-tokens',
      icon: <ArrowUpIcon />,
      disabled: isPaymentExpired,
    },
    {
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <ArrowDownIcon />,
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
