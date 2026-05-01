'use client';

import Link from 'next/link';
import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
import { usePathname } from 'next/navigation';
import { cleanPath } from './clean-path';
import { PATH_SELECT_CREATE_ACTION } from '@web/app/constants';
import { useAuthentication } from '@hypha-platform/authentication';
import { useSpaceMember } from '@hypha-platform/epics';
import { useIsDelegate } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

interface ActionButtonsProps {
  web3SpaceId?: number;
}

export const ActionButtons = ({ web3SpaceId }: ActionButtonsProps) => {
  const disabledReasonId = React.useId();
  const tDho = useTranslations('DHO');
  const tCommon = useTranslations('Common');
  const pathname = usePathname();
  const { isAuthenticated } = useAuthentication();
  const { isMember } = useSpaceMember({ spaceId: web3SpaceId });
  const { isDelegate } = useIsDelegate({ spaceId: web3SpaceId });

  const isDisabled = !isAuthenticated || (!isMember && !isDelegate);
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember && !isDelegate
    ? tCommon('joinSpaceToUse')
    : '';

  const createHref =
    isAuthenticated && (isMember || isDelegate)
      ? `${cleanPath(pathname)}${PATH_SELECT_CREATE_ACTION}`
      : '';

  const createLabel = tDho('actionButtons.createProposal');
  const iconButtonClass = cn(
    'h-10 w-10 shrink-0 rounded-full border-white/25 bg-white/10 text-white shadow-sm backdrop-blur-sm',
    'hover:border-white/40 hover:bg-white/15 hover:text-white',
    'disabled:border-white/15 disabled:bg-white/5 disabled:text-white/35',
    '[&_svg]:size-[1.125rem] [&_svg]:stroke-[2.25]',
  );

  if (isDisabled || !createHref) {
    const reason = tooltipMessage || createLabel;
    return (
      <span
        className="inline-flex"
        tabIndex={0}
        aria-describedby={disabledReasonId}
      >
        <span id={disabledReasonId} className="sr-only">
          {reason}
        </span>
        <Button
          type="button"
          disabled
          size="icon"
          variant="outline"
          colorVariant="accent"
          className={iconButtonClass}
          title={reason}
          aria-label={createLabel}
        >
          <Plus aria-hidden />
        </Button>
      </span>
    );
  }

  return (
    <Button
      asChild
      size="icon"
      variant="outline"
      colorVariant="accent"
      className={iconButtonClass}
    >
      <Link
        href={createHref}
        scroll={false}
        title={createLabel}
        aria-label={createLabel}
      >
        <Plus aria-hidden />
      </Link>
    </Button>
  );
};
