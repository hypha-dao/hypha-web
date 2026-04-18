'use client';

import { useMemo } from 'react';

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
import {
  useSpaceBySlug,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';

function normalizeTreasuryAddress(
  candidate: string | null | undefined,
): `0x${string}` | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return undefined;
  if (trimmed.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return undefined;
  return trimmed as `0x${string}`;
}

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
  const web3SpaceId =
    typeof space?.web3SpaceId === 'number' ? space.web3SpaceId : undefined;
  const { spaceDetails } = useSpaceDetailsWeb3Rpc({
    spaceId: web3SpaceId,
  });

  /** DB `address` or on-chain executor (treasury); either may be populated first. */
  const treasuryAddress = useMemo(() => {
    const fromDb = normalizeTreasuryAddress(space?.address);
    if (fromDb) return fromDb;
    return normalizeTreasuryAddress(spaceDetails?.executor);
  }, [space?.address, spaceDetails?.executor]);

  const { fundWallet } = useFundWallet({
    address: treasuryAddress,
  });
  const t = useTranslations('SelectActivateAction');

  const SELECT_ACTIVATE_ACTIONS = [
    {
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <ArrowDownIcon />,
      baseTab: 'treasury',
      onAction: () => {
        if (!treasuryAddress) return;
        fundWallet();
      },
      disabled: !treasuryAddress,
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
      showTitle={false}
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
