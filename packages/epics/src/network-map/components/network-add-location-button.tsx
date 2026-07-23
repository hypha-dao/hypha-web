'use client';

import { Address, Space, isSpaceArchived } from '@hypha-platform/core/client';
import { useMe } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { MapPinIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useMemberWeb3SpaceIds } from '../../spaces/hooks/use-member-web3-space-ids';
import { buildNetworkAddLocationConfigurationPath } from '../lib/add-location-return';

function filterMemberSpaces(
  spaces: Space[],
  personSlug: string | undefined,
  web3SpaceIds: readonly bigint[] | undefined,
) {
  if (!personSlug || !web3SpaceIds) {
    return [];
  }
  return spaces.filter((space) => {
    const spaceId = space.web3SpaceId ? BigInt(space.web3SpaceId) : null;
    return spaceId !== null && web3SpaceIds.includes(spaceId);
  });
}

type NetworkAddLocationButtonProps = {
  lang: Locale;
  spaces: Space[];
  className?: string;
  isAuthenticated: boolean;
};

export function NetworkAddLocationButton({
  lang,
  spaces,
  className,
  isAuthenticated,
}: NetworkAddLocationButtonProps) {
  const t = useTranslations('NetworkMap');
  const tCommon = useTranslations('Common');
  const { person } = useMe();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selectedSlug, setSelectedSlug] = React.useState('');

  const { web3SpaceIds, isLoading: isLoadingMemberSpaces } =
    useMemberWeb3SpaceIds({
      personAddress: person?.address as Address | undefined,
    });

  const mySpaces = React.useMemo(
    () =>
      filterMemberSpaces(spaces, person?.slug, web3SpaceIds).filter(
        (space) => !isSpaceArchived(space),
      ),
    [spaces, person?.slug, web3SpaceIds],
  );

  const spaceOptions = React.useMemo(
    () =>
      mySpaces.map((space) => ({
        value: space.slug,
        label: space.title,
        searchText: space.title.toLowerCase(),
      })),
    [mySpaces],
  );

  const handleContinue = React.useCallback(() => {
    if (!selectedSlug) {
      return;
    }
    setOpen(false);
    router.push(buildNetworkAddLocationConfigurationPath(lang, selectedSlug));
  }, [lang, router, selectedSlug]);

  React.useEffect(() => {
    if (!open) {
      setSelectedSlug('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'font-medium text-neutral-11 hover:text-foreground',
            className,
          )}
          disabled={!isAuthenticated}
          title={!isAuthenticated ? tCommon('signIn') : undefined}
        >
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
          {t('addLocation')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addLocationTitle')}</DialogTitle>
          <DialogDescription>{t('addLocationDescription')}</DialogDescription>
        </DialogHeader>
        {isLoadingMemberSpaces ? (
          <p className="text-2 text-neutral-11">{t('addLocationLoading')}</p>
        ) : mySpaces.length === 0 ? (
          <p className="text-2 text-neutral-11">{t('addLocationNoSpaces')}</p>
        ) : (
          <Select
            value={selectedSlug || undefined}
            onValueChange={setSelectedSlug}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('addLocationSelectPlaceholder')} />
            </SelectTrigger>
            <SelectContent className="z-[100] max-h-60">
              {spaceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!selectedSlug}
          >
            {t('addLocationContinue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
