'use client';

import {
  SelectAction,
  useActionGating,
  useCanMutateInSpace,
  type ActionProps,
} from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { isAbsoluteUrl } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import {
  Coins,
  Code2,
  DoorOpen,
  Download,
  Eye,
  Flame,
  FolderPlus,
  Gift,
  LayoutDashboard,
  Link2,
  LogOut,
  UserRound,
  Puzzle,
  Rocket,
  ShoppingBag,
  Sparkles,
  Vault,
  Wallet,
  Workflow,
  Zap,
} from 'lucide-react';

import { HyphaEnergyIcon } from './icons/hypha-energy-icon';

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
  const { isPaymentExpired, fundWallet, space } = useActionGating(daoSlug);
  const { canMutate, isLoading: isMutateLoading } = useCanMutateInSpace({
    spaceSlug: daoSlug,
    space,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const t = useTranslations('SpaceSettingsAction');
  const isActionDisabled = isMutateLoading || !canMutate;

  const SETTINGS_ACTIONS = [
    {
      group: t('groups.overview'),
      title: t('actions.spaceConfiguration.title'),
      description: t('actions.spaceConfiguration.description'),
      href: 'space-configuration',
      icon: (
        <LayoutDashboard className="size-[22px] shrink-0" strokeWidth={1.75} />
      ),
    },
    {
      group: t('groups.overview'),
      title: t('actions.spaceTransparencyConfiguration.title'),
      description: t('actions.spaceTransparencyConfiguration.description'),
      href: 'create/space-settings-transparency',
      icon: <Eye className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
    },
    {
      group: t('groups.overview'),
      title: t('actions.addSpace.title'),
      description: t('actions.addSpace.description'),
      href: 'space/create',
      icon: <FolderPlus className="size-[22px] shrink-0" strokeWidth={1.75} />,
    },
    {
      group: t('groups.overview'),
      title: t('actions.activateSpaces.title'),
      description: t('actions.activateSpaces.description'),
      href: 'create/activate-spaces',
      baseTab: 'agreements',
      icon: <Rocket className="size-[22px] shrink-0" strokeWidth={1.75} />,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.agreements'),
      title: t('actions.votingMethod.title'),
      description: t('actions.votingMethod.description'),
      href: 'create/change-voting-method',
      icon: <Zap className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.members'),
      title: t('actions.entryMethod.title'),
      description: t('actions.entryMethod.description'),
      href: 'create/change-entry-method',
      icon: <DoorOpen className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    //TODO: will be uncommented later
    /*{
      group: 'Members',
      title: 'Exit Method (Coming Soon)',
      description:
        'Select and configure how members can exit or leave your space.',
      href: '#',
      icon: <ExitIcon />,
      disabled: true,
    },*/
    {
      group: t('groups.members'),
      title: t('actions.membershipExit.title'),
      description: t('actions.membershipExit.description'),
      href: 'create/membership-exit',
      icon: <LogOut className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.members'),
      title: t('actions.spaceToSpaceMembership.title'),
      description: t('actions.spaceToSpaceMembership.description'),
      href: 'create/space-to-space-membership',
      icon: <Link2 className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.members'),
      title: t('actions.changeSpaceDelegate.title'),
      description: t('actions.changeSpaceDelegate.description'),
      href: 'create/change-space-delegate',
      icon: <UserRound className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.issueNewToken.title'),
      description: t('actions.issueNewToken.description'),
      href: 'create/issue-new-token',
      icon: <Coins className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.updateIssuedToken.title'),
      description: t('actions.updateIssuedToken.description'),
      href: 'create/update-issued-token',
      icon: <Workflow className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.mintTokensToSpaceTreasury.title'),
      description: t('actions.mintTokensToSpaceTreasury.description'),
      href: 'create/mint-tokens-to-space-treasury',
      icon: <Download className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.tokenBurning.title'),
      description: t('actions.tokenBurning.description'),
      href: 'create/token-burning',
      icon: <Flame className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.tokenBackingVault.title'),
      description: t('actions.tokenBackingVault.description'),
      href: 'create/token-backing-vault',
      icon: <Vault className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.spaceTokenPurchase.title'),
      description: t('actions.spaceTokenPurchase.description'),
      href: 'create/space-token-purchase',
      icon: <ShoppingBag className="size-[22px] shrink-0" strokeWidth={1.75} />,
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.buyHyphaTokensRewards.title'),
      description: t('actions.buyHyphaTokensRewards.description'),
      href: 'create/buy-hypha-tokens',
      icon: <Sparkles className="size-[22px] shrink-0" strokeWidth={1.75} />,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <Wallet className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'treasury',
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address,
    },
    {
      group: t('groups.extensionsPlugins'),
      title: t('actions.integrateSmartContractInSpace.title'),
      description: t('actions.integrateSmartContractInSpace.description'),
      href: 'https://hypha.services/',
      icon: <Code2 className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      target: '_blank',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.extensionsPlugins'),
      title: t('actions.exploreExtensionsMarketplaceComingSoon.title'),
      description: t(
        'actions.exploreExtensionsMarketplaceComingSoon.description',
      ),
      href: '#',
      icon: <Puzzle className="size-[22px] shrink-0" strokeWidth={1.75} />,
      baseTab: 'agreements',
      disabled: true,
      comingSoon: true,
    },
    {
      group: t('groups.ecosystemVerticals'),
      title: t('actions.hyphaEnergy.title'),
      description: t('actions.hyphaEnergy.description'),
      href: 'https://hypha.energy',
      icon: <HyphaEnergyIcon className="size-[22px]" />,
      baseTab: 'agreements',
      target: '_blank',
      disabled: isPaymentExpired,
    },
  ];

  const computeHref = (action: ActionProps) => {
    if (!action?.href) {
      return '';
    }
    if (isAbsoluteUrl(action.href)) {
      return action.href;
    }
    // Preserve known tab context for add-space modal routing.
    if (action.href === 'space/create') {
      if (activeTab === 'ecosystem-navigation' || activeTab === 'overview') {
        return `/${lang}/dho/${daoSlug}/${activeTab}/space/create`;
      }
      return `/${lang}/dho/${daoSlug}/space/create`;
    }
    const href = `/${lang}/dho/${daoSlug}/${action.baseTab || activeTab}/${
      action.href
    }`.replaceAll(
      'THIS_PAGE',
      `/${lang}/dho/${daoSlug}/agreements/select-settings-action`,
    );
    return href;
  };

  return (
    <SelectAction
      title={t('title')}
      content={t('content')}
      showTitle={false}
      searchPlaceholder={t('searchMenus')}
      noResultsLabel={t('noMenusFound')}
      actions={SETTINGS_ACTIONS.map((action) => {
        const href = computeHref(action);
        return {
          ...action,
          href,
          disabled:
            action.disabled ||
            (isActionDisabled && action.href !== 'https://hypha.energy'),
        };
      })}
    >
      {children}
    </SelectAction>
  );
};
