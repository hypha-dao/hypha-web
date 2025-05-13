import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import {
  CheckCircledIcon,
  PlusCircledIcon,
  RocketIcon,
} from '@radix-ui/react-icons';

export const CREATE_ACTIONS = [
  {
    title: 'Propose a Contribution',
    description:
      'Propose a new contribution, such as work, knowledge, capital, or resources, for the space to consider.',
    href: 'governance/create/propose-contribution',
    icon: <RocketIcon />,
  },
  {
    title: 'Make a Collective Agreement',
    description:
      'Define and formalize a mutual understanding, policy, or decision among members of the space.',
    href: 'governance/create',
    icon: <CheckCircledIcon />,
  },
  {
    title: 'Pay for Expenses',
    description:
      'Cover expenses by sending funds from the treasury to another space, entity, or wallet.',
    href: 'governance/create/pay-for-expenses',
    icon: <PlusCircledIcon />,
  },
  {
    title: 'Accept Investment',
    description:
      'Receive capital from investors, members, or aligned spaces in exchange for native space tokens.',
    href: '#',
    icon: <PlusCircledIcon />,
  },
  {
    title: 'Exchange Ownership',
    description:
      'Swap ownership between members or spaces, whether selling a stake or exchanging assets.',
    href: '#',
    icon: <PlusCircledIcon />,
  },
  {
    title: 'Deploy Funds',
    description:
      'Allocate treasury funds for investments or distributing resources among sub-spaces.',
    href: 'governance/create/deploy-funds',
    icon: <PlusCircledIcon />,
  },
  {
    title: 'Deposit Funds',
    description:
      'Deposit funds into your treasury by copying the treasury address or scanning the QR code.',
    href: 'treasury/deposit',
    icon: <PlusCircledIcon />,
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
