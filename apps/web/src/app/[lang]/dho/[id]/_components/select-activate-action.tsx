'use client';

import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { isAbsoluteUrl } from '@hypha-platform/ui-utils';
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

  const SELECT_ACTIVATE_ACTIONS = [
    {
      title: 'Deposit Funds',
      description:
        'Deposit funds into your treasury by copying the treasury address or scanning the QR code.',
      icon: <ArrowDownIcon />,
      baseTab: 'treasury',
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address,
    },
    {
      title: 'Buy Hypha Tokens (Rewards)',
      description:
        'Purchase Hypha tokens to participate in the network and earn rewards.',
      href: 'create/buy-hypha-tokens',
      baseTab: 'agreements',
      icon: <ArrowLeftIcon />,
    },
    {
      title: 'Activate Space(s)',
      description:
        'Contribute HYPHA or USDC to activate your space(s) and support the Hypha Network.',
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
      title="Activate Space"
      content="Choose one of the options below to activate your Space and unlock all the features available on the Hypha Network."
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
