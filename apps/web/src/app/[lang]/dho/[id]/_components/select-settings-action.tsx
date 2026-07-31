'use client';

import {
  SelectAction,
  useActionGating,
  useCanMutateInSpace,
  useSpaceEnergy,
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
  const { data: spaceEnergy } = useSpaceEnergy();
  const isEnergyCommunity = spaceEnergy?.enabled === true;
  const isActionDisabled = isMutateLoading || !canMutate;

  const SETTINGS_ACTIONS = [
    {
      group: t('groups.overview'),
      title: t('actions.spaceConfiguration.title'),
      description: t('actions.spaceConfiguration.description'),
      href: 'space-configuration',
      intents: ['space' as const],
      icon: <LayoutDashboard className="craft-icon" strokeWidth={1.5} />,
    },
    {
      group: t('groups.overview'),
      title: t('actions.spaceTransparencyConfiguration.title'),
      description: t('actions.spaceTransparencyConfiguration.description'),
      href: 'create/space-settings-transparency',
      intents: ['space' as const],
      icon: <Eye className="craft-icon" strokeWidth={1.5} />,
      baseTab: 'agreements',
    },
    {
      group: t('groups.overview'),
      title: t('actions.addSpace.title'),
      description: t('actions.addSpace.description'),
      href: 'space/create',
      intents: ['space' as const],
      icon: <FolderPlus className="craft-icon" strokeWidth={1.5} />,
    },
    {
      group: t('groups.overview'),
      title: t('actions.activateSpaces.title'),
      description: t('actions.activateSpaces.description'),
      href: 'create/activate-spaces',
      intents: ['space' as const],
      baseTab: 'agreements',
      icon: <Rocket className="craft-icon" strokeWidth={1.5} />,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.agreements'),
      title: t('actions.votingMethod.title'),
      description: t('actions.votingMethod.description'),
      href: 'create/change-voting-method',
      intents: ['vote' as const],
      icon: <Zap className="craft-icon" strokeWidth={1.5} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.members'),
      title: t('actions.entryMethod.title'),
      description: t('actions.entryMethod.description'),
      href: 'create/change-entry-method',
      intents: ['member' as const],
      icon: <DoorOpen className="craft-icon" strokeWidth={1.5} />,
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
      intents: ['member' as const],
      icon: <LogOut className="craft-icon" strokeWidth={1.5} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.members'),
      title: t('actions.spaceToSpaceMembership.title'),
      description: t('actions.spaceToSpaceMembership.description'),
      href: 'create/space-to-space-membership',
      intents: ['member' as const],
      icon: <Link2 className="craft-icon" strokeWidth={1.5} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.members'),
      title: t('actions.changeSpaceDelegate.title'),
      description: t('actions.changeSpaceDelegate.description'),
      href: 'create/change-space-delegate',
      intents: ['vote' as const],
      icon: <UserRound className="craft-icon" strokeWidth={1.5} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.issueNewToken.title'),
      description: t('actions.issueNewToken.description'),
      href: 'create/issue-new-token',
      intents: ['mint' as const, 'pay' as const],
      icon: <Coins className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.updateIssuedToken.title'),
      description: t('actions.updateIssuedToken.description'),
      href: 'create/update-issued-token',
      intents: ['mint' as const, 'pay' as const],
      icon: <Workflow className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.mintTokensToSpaceTreasury.title'),
      description: t('actions.mintTokensToSpaceTreasury.description'),
      href: 'create/mint-tokens-to-space-treasury',
      intents: ['mint' as const, 'pay' as const],
      icon: <Download className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.tokenBurning.title'),
      description: t('actions.tokenBurning.description'),
      href: 'create/token-burning',
      intents: ['mint' as const, 'pay' as const],
      icon: <Flame className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.tokenBackingVault.title'),
      description: t('actions.tokenBackingVault.description'),
      href: 'create/token-backing-vault',
      intents: ['mint' as const, 'pay' as const],
      icon: <Vault className="craft-icon" strokeWidth={1.5} />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.spaceTokenPurchase.title'),
      description: t('actions.spaceTokenPurchase.description'),
      href: 'create/space-token-purchase',
      intents: ['mint' as const, 'pay' as const],
      icon: <ShoppingBag className="craft-icon" strokeWidth={1.5} />,
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.buyHyphaTokensRewards.title'),
      description: t('actions.buyHyphaTokensRewards.description'),
      href: 'create/buy-hypha-tokens',
      intents: ['mint' as const, 'pay' as const],
      icon: <Sparkles className="craft-icon" strokeWidth={1.5} />,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <Wallet className="craft-icon" strokeWidth={1.5} />,
      intents: ['pay' as const],
      baseTab: 'treasury',
      onAction: () => {
        fundWallet();
      },
      disabled: !space?.address,
    },
    ...(!isEnergyCommunity
      ? [
          {
            defaultDurationDays: 5,
            group: t('groups.energy'),
            title: t('actions.enableEnergyCommunity.title'),
            description: t('actions.enableEnergyCommunity.description'),
            href: 'create/enable-energy-community',
            intents: ['space' as const],
            baseTab: 'agreements',
            icon: <Zap className="craft-icon" strokeWidth={1.5} />,
            disabled: isPaymentExpired,
          },
        ]
      : []),
    ...(isEnergyCommunity
      ? [
          {
            defaultDurationDays: 5,
            group: t('groups.energy'),
            title: t('actions.energySharing.title'),
            description: t('actions.energySharing.description'),
            href: 'create/energy-sharing',
            intents: ['space' as const],
            baseTab: 'agreements',
            icon: <Zap className="craft-icon" strokeWidth={1.5} />,
            disabled: isPaymentExpired,
          },
          {
            defaultDurationDays: 5,
            group: t('groups.energy'),
            title: t('actions.registerEnergySource.title'),
            description: t('actions.registerEnergySource.description'),
            href: 'create/register-energy-source',
            intents: ['space' as const],
            baseTab: 'agreements',
            icon: <Zap className="craft-icon" strokeWidth={1.5} />,
            disabled: isPaymentExpired,
          },
          {
            defaultDurationDays: 5,
            group: t('groups.energy'),
            title: t('actions.addEnergyMember.title'),
            description: t('actions.addEnergyMember.description'),
            href: 'create/add-energy-member',
            intents: ['space' as const],
            baseTab: 'agreements',
            icon: <Zap className="craft-icon" strokeWidth={1.5} />,
            disabled: isPaymentExpired,
          },
          {
            defaultDurationDays: 5,
            group: t('groups.energy'),
            title: t('actions.changeEnergyOptimization.title'),
            description: t('actions.changeEnergyOptimization.description'),
            href: 'create/change-energy-optimization',
            intents: ['space' as const],
            baseTab: 'agreements',
            icon: <Zap className="craft-icon" strokeWidth={1.5} />,
            disabled: isPaymentExpired,
          },
          {
            defaultDurationDays: 5,
            group: t('groups.energy'),
            title: t('actions.whitelistEnergySettlement.title'),
            description: t('actions.whitelistEnergySettlement.description'),
            href: 'create/whitelist-energy-settlement',
            intents: ['space' as const],
            baseTab: 'agreements',
            icon: <Zap className="craft-icon" strokeWidth={1.5} />,
            disabled: isPaymentExpired,
          },
        ]
      : []),
    {
      group: t('groups.extensionsPlugins'),
      title: t('actions.integrateSmartContractInSpace.title'),
      description: t('actions.integrateSmartContractInSpace.description'),
      href: 'https://hypha.services/',
      intents: ['space' as const],
      icon: <Code2 className="craft-icon" strokeWidth={1.5} />,
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
      intents: ['space' as const],
      icon: <Puzzle className="craft-icon" strokeWidth={1.5} />,
      baseTab: 'agreements',
      disabled: true,
      comingSoon: true,
    },
    {
      group: t('groups.ecosystemVerticals'),
      title: t('actions.hyphaEnergy.title'),
      description: t('actions.hyphaEnergy.description'),
      href: 'https://hypha.energy',
      intents: ['space' as const],
      icon: <HyphaEnergyIcon className="craft-icon" />,
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
