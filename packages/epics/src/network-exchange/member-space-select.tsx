'use client';

import { useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { Combobox, Image } from '@hypha-platform/ui';
import { resolveSpaceDisplayLogoUrl } from '../spaces/utils/resolve-space-display-logo-url';
import type { MemberNamedSpace } from './use-member-named-spaces';

function SpaceMark({
  title,
  logoUrl,
}: {
  title: string;
  logoUrl?: string | null;
}) {
  return (
    <>
      <Image
        src={logoUrl || DEFAULT_SPACE_AVATAR_IMAGE}
        alt=""
        width={24}
        height={24}
        className="size-6 shrink-0 rounded-full object-cover"
      />
      <span className="truncate">{title}</span>
    </>
  );
}

export function MemberSpaceSelect({
  spaces,
  value,
  onChange,
  label,
  emptyLabel,
  disabled,
}: {
  spaces: MemberNamedSpace[];
  value: string;
  onChange: (slug: string) => void;
  label: string;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const tSpaces = useTranslations('Spaces');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const isEmpty = spaces.length === 0;

  const options = useMemo(
    () =>
      spaces.map((space) => ({
        value: space.slug,
        label: space.title,
        avatarUrl:
          resolveSpaceDisplayLogoUrl(space, logoVariant) ??
          DEFAULT_SPACE_AVATAR_IMAGE,
      })),
    [logoVariant, spaces],
  );

  return (
    <Combobox
      options={options}
      initialValue={value}
      onChange={onChange}
      placeholder={isEmpty ? emptyLabel : label}
      searchPlaceholder={tSpaces('search')}
      emptyListMessage={emptyLabel}
      disabled={disabled || isEmpty}
      allowEmptyChoice={false}
      className="h-11 w-full bg-neutral-2 font-semibold md:w-full"
      renderOption={(option) => (
        <SpaceMark title={option.label} logoUrl={option.avatarUrl} />
      )}
      renderValue={(option) =>
        option ? (
          <div className="flex min-w-0 items-center gap-2 truncate">
            <SpaceMark title={option.label} logoUrl={option.avatarUrl} />
          </div>
        ) : (
          ''
        )
      }
    />
  );
}
