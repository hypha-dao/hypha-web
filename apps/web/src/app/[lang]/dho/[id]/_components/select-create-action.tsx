'use client';

import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  FileIcon,
  PlusCircledIcon,
  RocketIcon,
  Share1Icon,
} from '@radix-ui/react-icons';
import { useFundWallet } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { useSpaceBySlug } from '@hypha-platform/core/client';

export const SelectCreateAction = ({
  daoSlug,
  lang,
  children,
}: {
  daoSlug: string;
  lang: Locale;
  children?: React.ReactNode;
}) => {
  const { id: spaceSlug } = useParams();
  const { space } = useSpaceBySlug(spaceSlug as string);
  const { fundWallet } = useFundWallet({
    address: space?.address as `0x${string}`,
  });

  const CREATE_ACTIONS = [
    {
      defaultDurationDays: 3,
      title: 'Make a Collective Agreement',
      description:
        'Define and formalise a mutual understanding, policy, or decision among members of the space.',
      href: 'agreements/create',
      icon: <FileIcon />,
    },
    {
      defaultDurationDays: 4,
      title: 'Propose a Contribution',
      description:
        'Propose a new contribution, such as work, knowledge, capital, or resources, for the space to consider.',
      href: 'agreements/create/propose-contribution',
      icon: <RocketIcon />,
    },
    {
      defaultDurationDays: 7,
      title: 'Pay Expenses for Products or Services',
      description:
        'Make payments for products and services by transferring funds from your space treasury to another space, entity, or individual wallet.',
      href: 'agreements/create/pay-for-expenses',
      icon: <ArrowUpIcon />,
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
        href: `/${lang}/dho/${daoSlug}/${action.href}`,
      }))}
    >
      {children}
    </SelectAction>
  );
};
