'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@hypha-platform/ui';
import { useParams } from 'next/navigation';
import { getDhoPathSpaces } from '../@tab/spaces/constants';
import { Locale } from '@hypha-platform/i18n';
import { useSpaceDiscoverability } from '@hypha-platform/epics';
import { useUserSpaceState } from '@hypha-platform/epics';
import { checkAccess } from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

interface NestedSpacesButtonProps {
  web3SpaceId?: number;
  spaceSlug?: string;
}

export const NestedSpacesButton = ({
  web3SpaceId,
  spaceSlug,
}: NestedSpacesButtonProps) => {
  const tDho = useTranslations('DHO');
  const { lang: langParam, id: routeId } = useParams<{
    lang: string;
    id: string;
  }>();
  const { space } = useSpaceBySlug(spaceSlug || '');
  const effectiveSpaceId = web3SpaceId || space?.web3SpaceId || undefined;
  const effectiveSpaceSlug = spaceSlug || space?.slug;

  const { access, isLoading: isDiscoverabilityLoading } =
    useSpaceDiscoverability({
      spaceId: effectiveSpaceId ? BigInt(effectiveSpaceId) : undefined,
    });

  const { userState, isLoading: isUserStateLoading } = useUserSpaceState({
    spaceId: effectiveSpaceId,
    spaceSlug: effectiveSpaceSlug,
    space,
  });

  const hasAccess = checkAccess(access, userState);
  const isLoading = isDiscoverabilityLoading || isUserStateLoading;
  const isDisabled = isLoading || !hasAccess;

  const tooltipMessage = isLoading
    ? tDho('nestedSpacesButton.loading')
    : !hasAccess
    ? tDho('nestedSpacesButton.noAccess')
    : tDho('nestedSpacesButton.label');

  const toSpaces = getDhoPathSpaces(
    langParam as Locale,
    (spaceSlug || routeId || '') as string,
  );

  if (isDisabled) {
    return (
      <span
        data-space-nav
        className="inline-flex cursor-not-allowed"
        aria-disabled="true"
        tabIndex={-1}
        title={tooltipMessage}
      >
        <Button
          variant="link"
          disabled
          className="flex h-auto min-h-0 shrink-0 items-center gap-2 px-0 py-0 text-xs font-medium"
        >
          <Eye className="w-4 h-4" />
          <span>{tDho('nestedSpacesButton.label')}</span>
        </Button>
      </span>
    );
  }

  return (
    <Link data-space-nav href={toSpaces} title={tooltipMessage}>
      <Button
        variant="link"
        className="flex h-auto min-h-0 shrink-0 items-center gap-2 px-0 py-0 text-xs font-medium"
      >
        <Eye className="w-4 h-4" />
        <span>{tDho('nestedSpacesButton.label')}</span>
      </Button>
    </Link>
  );
};
