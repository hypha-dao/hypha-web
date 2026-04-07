'use client';

import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { isAbsoluteUrl } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@radix-ui/react-icons';
import { useFundWallet } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { useSpaceBySlug } from '@hypha-platform/core/client';

export const SelectActivateAction = ({
  daoSlug,
  activeTab,
  lang,
}: {
  daoSlug: string;
  activeTab: string;
  lang: Locale;
}) => {
  const { id: spaceSlug } = useParams();
  const { space } = useSpaceBySlug(spaceSlug as string);
  const { fundWallet } = useFundWallet({
    address: space?.address as `0x${string}`,
  });
  const t = useTranslations('SelectActivateAction');

  const SELECT_ACTIVATE_ACTIONS = [
    {
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <ArrowDownIcon />,
      baseTab: 'treasury',
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address,
    },
    {
      title: t('actions.buyHyphaTokensRewards.title'),
      description: t('actions.buyHyphaTokensRewards.description'),
      href: 'create/buy-hypha-tokens',
      baseTab: 'agreements',
      icon: <ArrowLeftIcon />,
    },
    {
      title: t('actions.activateSpaces.title'),
      description: t('actions.activateSpaces.description'),
      href: 'create/activate-spaces',
      baseTab: 'agreements',
      icon: <ArrowRightIcon />,
    },
  ];

  const computeHref = (
    action: { href?: string; baseTab?: string } | undefined,
  ) => {
    if (!action?.href) {
      return '';
    }
    const href = isAbsoluteUrl(action.href)
      ? action.href
      : `/${lang}/dho/${daoSlug}/${action.baseTab || activeTab}/${
          action.href
        }`.replaceAll(
          'THIS_PAGE',
          `/${lang}/dho/${daoSlug}/agreements/select-activate-action`,
        );
    return href;
  };

  return (
    <SelectAction
      title={t('title')}
      content={t('content')}
      actions={SELECT_ACTIVATE_ACTIONS.map((action) => {
        const href = computeHref(action);
        return {
          ...action,
          href,
        };
      })}
    />
  );
};
