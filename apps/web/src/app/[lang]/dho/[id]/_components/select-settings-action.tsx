import { SelectAction } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { isAbsoluteUrl } from '@hypha-platform/ui-utils';
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CrossCircledIcon,
  EnterIcon,
  ExitIcon,
  GearIcon,
  MixerVerticalIcon,
  PlusCircledIcon,
  RadiobuttonIcon,
} from '@radix-ui/react-icons';

export const SETTINGS_ACTIONS = [
  {
    group: 'Organisation',
    title: 'Space Configuration',
    description:
      'Customize your space by setting its purpose, adding branding elements, and linking social media.',
    href: 'space-configuration',
    icon: <GearIcon />,
  },
  {
    group: 'Organisation',
    title: 'New Sub-Space',
    description:
      'Create and configure a new sub-space within your main space for specific activities or teams.',
    href: 'space/create',
    icon: <PlusCircledIcon />,
    baseTab: 'membership',
  },
  {
    group: 'Organisation',
    title: 'Archive Space (Coming Soon)',
    description:
      'Archive this space to disable activity while preserving its data and history.',
    href: '#',
    icon: <ArchiveIcon />,
    baseTab: 'membership',
    disabled: true,
  },
  {
    defaultDurationDays: 4,
    group: 'Governance',
    title: 'Voting Method',
    description:
      'Select and configure the voting method for decision-making within your space.',
    href: 'create/change-voting-method',
    icon: <MixerVerticalIcon />,
    baseTab: 'governance',
  },
  {
    defaultDurationDays: 4,
    group: 'Membership',
    title: 'Entry Method',
    description:
      'Select and configure the process by which new members join your space.',
    href: 'create/change-entry-method',
    icon: <EnterIcon />,
    baseTab: 'governance',
  },
  {
    group: 'Membership',
    title: 'Exit Method (Coming Soon)',
    description:
      'Select and configure how members can exit or leave your space.',
    href: '#',
    icon: <ExitIcon />,
    disabled: true,
  },
  {
    group: 'Membership',
    title: 'Membership Removal (Coming Soon)',
    description:
      'Remove a member from your space if they infringe upon agreed rules and policies.',
    href: '#',
    icon: <CrossCircledIcon />,
    disabled: true,
  },
  {
    defaultDurationDays: 4,
    group: 'Treasury',
    title: 'Issue New Token',
    description:
      'Create a new token for utility, cash credit, or ownership within your space.',
    href: 'create/issue-new-token',
    icon: <RadiobuttonIcon />,
    baseTab: 'governance',
  },
  {
    group: 'Treasury',
    title: 'Integrate Smart Contract in Space (Advanced)',
    description:
      'Enable your space to take multisig ownership of your smart contracts, allowing your community to govern value flows (tokenomics) directly from your space.',
    href: 'https://discord.gg/W7Cz7XD3BS',
    icon: <RadiobuttonIcon />,
    baseTab: 'governance',
    target: '_blank',
  },
  {
    group: 'Treasury',
    title: 'Deposit Funds',
    description:
      'Deposit funds into your treasury by copying the treasury address or scanning the QR code.',
    href: 'deposit?back=THIS_PAGE',
    icon: <ArrowDownIcon />,
    baseTab: 'treasury',
  },
  {
    group: 'Extensions & Plug-ins',
    title: 'Explore Extensions & Plug-in Marketplace (Coming Soon)',
    description:
      'Discover a growing ecosystem of tools and integrations to extend your space’s capabilities.',
    href: '#',
    icon: <RadiobuttonIcon />,
    baseTab: 'governance',
    disabled: true,
  },
  {
    group: 'Ecosystem Verticals',
    title: 'Hypha Energy',
    description:
      'A dedicated platform for your renewable energy community or hub, enabling local energy sharing, energy asset co-ownership, governance, and fair value distribution between members.',
    href: 'https://hypha.energy',
    icon: <RadiobuttonIcon />,
    baseTab: 'governance',
    target: '_blank',
  },
  {
    group: 'Hypha Network Tokenomics',
    title: 'Buy Hypha Tokens (Rewards) (Coming Soon)',
    description:
      'Purchase Hypha tokens to participate in the network and earn rewards.',
    href: '#',
    icon: <ArrowLeftIcon />,
    disabled: true,
  },
  {
    group: 'Hypha Network Tokenomics',
    title: 'Activate Space(s) (Coming Soon)',
    description:
      'Activate your Spaces by simply paying a Hypha Network Contribution with USDC or Hypha Tokens.',
    href: '#',
    icon: <ArrowRightIcon />,
    disabled: true,
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
  const computeHref = (action: any) => {
    if (!action?.href) {
      return '';
    }
    const href = isAbsoluteUrl(action.href)
      ? action.href
      : `/${lang}/dho/${daoSlug}/${action.baseTab || activeTab}/${
          action.href
        }`.replaceAll(
          'THIS_PAGE',
          `/${lang}/dho/${daoSlug}/governance/select-settings-action`,
        );
    return href;
  };

  return (
    <SelectAction
      title="Space Settings"
      content="Access and manage the settings for your space, including its appearance, structure, methods, membership, and treasury."
      actions={SETTINGS_ACTIONS.map((action) => {
        const href = computeHref(action);
        return {
          ...action,
          href,
        };
      })}
    />
  );
};
