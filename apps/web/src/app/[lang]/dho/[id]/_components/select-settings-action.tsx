'use client';

import {
  SelectAction,
  useFundWallet,
  useSalesBanner,
} from '@hypha-platform/epics';
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
  Link2Icon,
} from '@radix-ui/react-icons';
import { useSpaceBySlug } from '@hypha-platform/core/client';

type SelectSettingsActionProps = {
  daoSlug: string;
  activeTab: string;
  lang: Locale;
  children?: React.ReactNode;
};

export const SelectSettingsAction = ({
  daoSlug,
  activeTab,
  lang,
  children,
}: SelectSettingsActionProps) => {
  const { space } = useSpaceBySlug(daoSlug);
  const { status, isLoading: isStatusLoading } = useSalesBanner({
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const { fundWallet } = useFundWallet({
    address: space?.address as `0x${string}`,
  });
  const isPaymentExpired = isStatusLoading ? false : status === 'expired';

  const SETTINGS_ACTIONS = [
    {
      group: 'Overview',
      title: 'Space Configuration',
      description:
        'Customise your space by setting its purpose, adding branding elements, and linking social media.',
      href: 'space-configuration',
      icon: <GearIcon />,
    },
    {
      group: 'Overview',
      title: 'Add Space',
      description:
        'Create a new space within your organisation for activities, teams, or projects.',
      href: 'space/create',
      icon: <PlusCircledIcon />,
      baseTab: 'overview',
    },
    {
      group: 'Overview',
      title: 'Activate Space(s)',
      description:
        'Contribute HYPHA or USDC to activate your space(s) and support the Hypha Network.',
      href: 'create/activate-spaces',
      baseTab: 'agreements',
      icon: <ArrowRightIcon />,
    },
    {
      group: 'Overview',
      title: 'Archive Space (Coming Soon)',
      description:
        'Archive this space to disable activity while preserving its data and history.',
      href: '#',
      icon: <ArchiveIcon />,
      baseTab: 'members',
      disabled: true,
    },
    {
      defaultDurationDays: 4,
      group: 'Agreements',
      title: 'Voting Method',
      description:
        'Select and configure the voting method for decision-making within your space.',
      href: 'create/change-voting-method',
      icon: <MixerVerticalIcon />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: 'Members',
      title: 'Entry Method',
      description:
        'Select and configure the process by which new members join your space.',
      href: 'create/change-entry-method',
      icon: <EnterIcon />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: 'Members',
      title: 'Exit Method (Coming Soon)',
      description:
        'Select and configure how members can exit or leave your space.',
      href: '#',
      icon: <ExitIcon />,
      disabled: true,
    },
    {
      group: 'Members',
      title: 'Membership Removal (Coming Soon)',
      description:
        'Remove a member from your space if they infringe upon agreed rules and policies.',
      href: '#',
      icon: <CrossCircledIcon />,
      disabled: true,
    },
    {
      group: 'Members',
      title: 'Space-to-Space Membership',
      description:
        'Allow your space to join another space as a member, gaining the ability to participate in governance and vote on proposals.',
      href: 'create/space-to-space-membership',
      icon: <Link2Icon />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: 'Treasury',
      title: 'Issue New Token',
      description:
        'Create a new token for utility, ownership, impact, cash credits, or voice within your space.',
      href: 'create/issue-new-token',
      icon: <RadiobuttonIcon />,
      disabled: isPaymentExpired,
    },
    {
      group: 'Treasury',
      title: 'Mint Tokens to Space Treasury',
      description:
        'Mint tokens into your space treasury to fund operations, distribute rewards, or provide liquidity.',
      href: 'create/mint-tokens-to-space-treasury',
      icon: <ArrowDownIcon />,
      disabled: isPaymentExpired,
    },
    {
      group: 'Treasury',
      title: 'Buy Hypha Tokens (Rewards)',
      description:
        'Purchase Hypha tokens to participate in the network and earn rewards.',
      href: 'create/buy-hypha-tokens',
      icon: <ArrowLeftIcon />,
    },
    {
      group: 'Treasury',
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
      group: 'Extensions & Plug-ins',
      title: 'Integrate Smart Contract in Space (Advanced)',
      description:
        'Enable your space to take multisig ownership of your smart contracts, allowing your community to govern value flows (tokenomics) directly from your space.',
      href: 'https://discord.gg/W7Cz7XD3BS',
      icon: <RadiobuttonIcon />,
      baseTab: 'agreements',
      target: '_blank',
      disabled: isPaymentExpired,
    },
    {
      group: 'Extensions & Plug-ins',
      title: 'Explore Extensions & Plug-in Marketplace (Coming Soon)',
      description:
        'Discover a growing ecosystem of tools and integrations to extend your space’s capabilities.',
      href: '#',
      icon: <RadiobuttonIcon />,
      baseTab: 'agreements',
      disabled: true,
    },
    {
      group: 'Ecosystem Verticals',
      title: 'Hypha Energy',
      description:
        'A dedicated platform for your renewable energy community or hub, enabling local energy sharing, energy asset co-ownership, governance, and fair value distribution between members.',
      href: 'https://hypha.energy',
      icon: <RadiobuttonIcon />,
      baseTab: 'agreements',
      target: '_blank',
      disabled: isPaymentExpired,
    },
  ];

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
          `/${lang}/dho/${daoSlug}/agreements/select-settings-action`,
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
    >
      {children}
    </SelectAction>
  );
};
