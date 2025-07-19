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

export const CREATE_ACTIONS = [
  {
    title: 'Make a Collective Agreement',
    description:
      'Define and formalize a mutual understanding, policy, or decision among members of the space.',
    href: 'governance/create',
    icon: <FileIcon />,
  },
  {
    title: 'Propose a Contribution',
    description:
      'Propose a new contribution, such as work, knowledge, capital, or resources, for the space to consider.',
    href: 'governance/create/propose-contribution',
    icon: <RocketIcon />,
  },
  {
    title: 'Pay for Expenses',
    description:
      'Cover expenses by sending funds from the treasury to another space, entity, or wallet.',
    href: 'governance/create/pay-for-expenses',
    icon: <ArrowUpIcon />,
  },
  {
    title: 'Accept Investment (Coming Soon)',
    description:
      'Receive capital from investors, members, or aligned spaces in exchange for native space tokens.',
    href: '#',
    icon: <PlusCircledIcon />,
    disabled: true,
  },
  {
    title: 'Exchange Ownership (Coming Soon)',
    description:
      'Swap ownership between members or spaces, whether selling a stake or exchanging assets.',
    href: '#',
    icon: <PlusCircledIcon />,
    disabled: true,
  },
  {
    title: 'Deploy Funds',
    description:
      'Allocate treasury funds for investments or distributing resources among sub-spaces.',
    href: 'governance/create/deploy-funds',
    icon: <Share1Icon />,
  },
  {
    title: 'Deposit Funds',
    description:
      'Deposit funds into your treasury by copying the treasury address or scanning the QR code.',
    href: 'treasury/deposit',
    icon: <ArrowDownIcon />,
  },
];

export const SelectCreateAction = ({
  daoSlug,
  lang,
}: {
  daoSlug: string;
  lang: Locale;
}) => {
  return (
    <SelectAction
      title="Create a Proposal"
      content="Select an action to contribute, collaborate, make decisions or manage resources within your space."
      actions={CREATE_ACTIONS.map((action) => ({
        ...action,
        href: `/${lang}/dho/${daoSlug}/${action.href}`,
      }))}
    />
  );
};
