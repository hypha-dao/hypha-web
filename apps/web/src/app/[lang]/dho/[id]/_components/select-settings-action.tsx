import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { Pencil2Icon } from '@radix-ui/react-icons';

export const SETTINGS_ACTIONS = [
  {
    group: 'Organisation',
    title: 'Space Configuration',
    description:
      'Customize your space by setting its purpose, adding branding elements, and linking social media.',
    href: 'space-configuration',
    icon: <Pencil2Icon />,
  },
  {
    group: 'Organisation',
    title: 'New Sub-Space',
    description:
      'Create and configure a new sub-space within your main space for specific activities or teams.',
    href: 'space/create',
    icon: <Pencil2Icon />,
    baseTab: 'membership',
  },
  {
    group: 'Agreements',
    title: 'Voting Method',
    description:
      'Select and configure the voting method for decision-making within your space.',
    href: 'create/change-voting-method',
    icon: <Pencil2Icon />,
    baseTab: 'governance',
  },
  {
    group: 'Membership',
    title: 'Entry Method',
    description:
      'Select and configure the process by which new members join your space.',
    href: '#',
    icon: <Pencil2Icon />,
  },
  {
    group: 'Membership',
    title: 'Exit Method',
    description:
      'Select and configure how members can exit or leave your space.',
    href: '#',
    icon: <Pencil2Icon />,
  },
  {
    group: 'Membership',
    title: 'Membership Removal',
    description:
      'Remove a member from your space if they infringe upon agreed rules and policies.',
    href: '#',
    icon: <Pencil2Icon />,
  },
  {
    group: 'Tokens',
    title: 'Issue New Token',
    description:
      'Create a new token for utility, cash credit, or ownership within your space.',
    href: '#',
    icon: <Pencil2Icon />,
  },
  {
    group: 'Hypha Network Tokenomics',
    title: 'Buy Hypha Tokens (Rewards)',
    description:
      'Purchase Hypha tokens to participate in the network and earn rewards.',
    href: '#',
    icon: <Pencil2Icon />,
  },
  {
    group: 'Hypha Network Tokenomics',
    title: 'Pay in Hypha Tokens (Hypha Network Contribution)',
    description:
      'All spaces within the Network are required to make a monthly payment in Hypha tokens to use the platform.',
    href: '#',
    icon: <Pencil2Icon />,
  },
];

export const SelectSettingsAction = ({
  daoSlug,
  activeTab,
  lang,
}: {
  daoSlug: string;
  activeTab: string;
  lang: Locale;
}) => {
  return (
    <SelectAction
      title="Space Settings"
      content="Access and manage the settings for your space, including its appearance, structure, methods, membership, and treasury."
      actions={SETTINGS_ACTIONS.map((action) => ({
        ...action,
        href: `/${lang}/dho/${daoSlug}/${action.baseTab || activeTab}/${
          action.href
        }`,
      }))}
    />
  );
};
