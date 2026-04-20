import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar, AvatarImage } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { Text } from '@radix-ui/themes';

import { DEFAULT_SPACE_AVATAR_IMAGE } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

import {
  SPACE_HEADER_IDENTITY_AVATAR_CLASS,
  SPACE_HEADER_IDENTITY_TITLE_CLASS_CHROME,
} from './space-header-identity-tokens';

type SpaceHeaderIdentityCrumbsProps = {
  lang: Locale;
  title: string;
  logoUrl: string | null;
};

export async function SpaceHeaderIdentityCrumbs({
  lang,
  title,
  logoUrl,
}: SpaceHeaderIdentityCrumbsProps) {
  const tNavigation = await getTranslations('Navigation');
  const src = logoUrl || DEFAULT_SPACE_AVATAR_IMAGE;

  return (
    <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
      <Link
        href={`/${lang}/my-spaces`}
        className="shrink-0 text-[11px] font-medium leading-tight text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {tNavigation('mySpaces')}
      </Link>
      <ChevronRight
        className="size-3.5 shrink-0 text-muted-foreground/70"
        aria-hidden
      />
      <Avatar className={SPACE_HEADER_IDENTITY_AVATAR_CLASS} aria-hidden>
        <AvatarImage src={src} alt="" className="object-cover" />
      </Avatar>
      <Text
        className={cn(
          SPACE_HEADER_IDENTITY_TITLE_CLASS_CHROME,
          'min-w-0 truncate',
        )}
      >
        {title}
      </Text>
    </div>
  );
}
