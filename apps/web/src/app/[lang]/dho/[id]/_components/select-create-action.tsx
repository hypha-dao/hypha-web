'use client';

import {
  SelectAction,
  useFundWallet,
  useSalesBanner,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  FileIcon,
  PlusCircledIcon,
  RocketIcon,
  Share1Icon,
} from '@radix-ui/react-icons';
import { useSpaceBySlug } from '@hypha-platform/core/client';

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
  const { space } = useSpaceBySlug(daoSlug);
  const { status, isLoading: isStatusLoading } = useSalesBanner({
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const { fundWallet } = useFundWallet({
    address: space?.address as `0x${string}`,
  });
  const isPaymentExpired = isStatusLoading ? false : status === 'expired';

  const CREATE_ACTIONS = [
    {
      defaultDurationDays: 3,
      title: 'Make a Collective Agreement',
      description:
        'Define and formalise a mutual understanding, policy, or decision among members of the space.',
      href: 'agreements/create',
      icon: <FileIcon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      title: 'Propose a Contribution',
      description:
        'Propose a new contribution, such as work, knowledge, capital, or resources, for the space to consider.',
      href: 'agreements/create/propose-contribution',
      icon: <RocketIcon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 7,
      title: 'Pay Expenses for Products or Services',
      description:
        'Make payments for products and services by transferring funds from your space treasury to another space, entity, or individual wallet.',
      href: 'agreements/create/pay-for-expenses',
      icon: <ArrowUpIcon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 7,
      title: 'Accept Investment (Coming Soon)',
      description:
        'Receive capital from investors, members, or aligned spaces in exchange for native space tokens.',
      href: '#',
      icon: <PlusCircledIcon />,
      disabled: true,
    },
    {
      defaultDurationDays: 7,
      title: 'Exchange Ownership (Coming Soon)',
      description:
        'Swap ownership between members or spaces, whether selling a stake or exchanging assets.',
      href: '#',
      icon: <PlusCircledIcon />,
      disabled: true,
    },
    {
      defaultDurationDays: 7,
      title: 'Deploy Funds',
      description:
        'Allocate treasury funds for investments in other spaces in the network or for distributing resources across spaces within your organisation.',
      href: 'agreements/create/deploy-funds',
      icon: <Share1Icon />,
      disabled: isPaymentExpired,
    },
    {
      title: 'Deposit Funds',
      description:
        'Deposit funds into your treasury by copying the treasury address or scanning the QR code.',
      icon: <ArrowDownIcon />,
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address,
    },
  ];
  return (
    <SelectAction
      title="Create a Proposal"
      content="Select an action to contribute, collaborate, make decisions or manage resources within your space."
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
