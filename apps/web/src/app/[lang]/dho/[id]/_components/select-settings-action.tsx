'use client';

import { SelectAction, useActionGating } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';
import { isAbsoluteUrl } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CrossCircledIcon,
  EnterIcon,
  GearIcon,
  MixerVerticalIcon,
  PlusCircledIcon,
  RadiobuttonIcon,
  Link2Icon,
} from '@radix-ui/react-icons';

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
  const t = useTranslations('SpaceSettingsAction');

  const SETTINGS_ACTIONS = [
    {
      group: t('groups.overview'),
      title: t('actions.spaceConfiguration.title'),
      description: t('actions.spaceConfiguration.description'),
      href: 'space-configuration',
      icon: <GearIcon />,
    },
    {
      group: t('groups.overview'),
      title: t('actions.spaceTransparencyConfiguration.title'),
      description: t('actions.spaceTransparencyConfiguration.description'),
      href: 'create/space-settings-transparency',
      icon: <GearIcon />,
      baseTab: 'agreements',
    },
    {
      group: t('groups.overview'),
      title: t('actions.addSpace.title'),
      description: t('actions.addSpace.description'),
      href: 'space/create',
      icon: <PlusCircledIcon />,
    },
    {
      group: t('groups.overview'),
      title: t('actions.activateSpaces.title'),
      description: t('actions.activateSpaces.description'),
      href: 'create/activate-spaces',
      baseTab: 'agreements',
      icon: <ArrowRightIcon />,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.agreements'),
      title: t('actions.votingMethod.title'),
      description: t('actions.votingMethod.description'),
      href: 'create/change-voting-method',
      icon: <MixerVerticalIcon />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.members'),
      title: t('actions.entryMethod.title'),
      description: t('actions.entryMethod.description'),
      href: 'create/change-entry-method',
      icon: <EnterIcon />,
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
      icon: <CrossCircledIcon />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.members'),
      title: t('actions.spaceToSpaceMembership.title'),
      description: t('actions.spaceToSpaceMembership.description'),
      href: 'create/space-to-space-membership',
      icon: <Link2Icon />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.issueNewToken.title'),
      description: t('actions.issueNewToken.description'),
      href: 'create/issue-new-token',
      icon: <RadiobuttonIcon />,
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.mintTokensToSpaceTreasury.title'),
      description: t('actions.mintTokensToSpaceTreasury.description'),
      href: 'create/mint-tokens-to-space-treasury',
      icon: <ArrowDownIcon />,
      disabled: isPaymentExpired,
    },
    {
      defaultDurationDays: 4,
      group: t('groups.treasury'),
      title: t('actions.tokenBackingVault.title'),
      description: t('actions.tokenBackingVault.description'),
      href: 'create/token-backing-vault',
      icon: <RadiobuttonIcon />,
      baseTab: 'agreements',
      disabled: isPaymentExpired,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.buyHyphaTokensRewards.title'),
      description: t('actions.buyHyphaTokensRewards.description'),
      href: 'create/buy-hypha-tokens',
      icon: <ArrowLeftIcon />,
    },
    {
      group: t('groups.treasury'),
      title: t('actions.depositFunds.title'),
      description: t('actions.depositFunds.description'),
      icon: <ArrowDownIcon />,
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
      href: 'https://discord.gg/W7Cz7XD3BS',
      icon: <RadiobuttonIcon />,
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
      icon: <RadiobuttonIcon />,
      baseTab: 'agreements',
      disabled: true,
    },
    {
      group: t('groups.ecosystemVerticals'),
      title: t('actions.hyphaEnergy.title'),
      description: t('actions.hyphaEnergy.description'),
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
    if (isAbsoluteUrl(action.href)) {
      return action.href;
    }
    // Special case: space/create is an aside route, not a tab route
    if (action.href === 'space/create') {
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
