'use client';

import Link from 'next/link';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { Text } from '@radix-ui/themes';
import { useMemberExperience } from '@hypha-platform/epics';
import { useTranslations } from 'next-intl';

/** Profile breadcrumb. Members go home; every other persona still goes to Spaces. */
export function ProfileBackLink({ lang }: { lang: string }) {
  const tNav = useTranslations('Navigation');
  const { isMember: member } = useMemberExperience();

  return (
    <Link
      href={member ? `/${lang}/home` : `/${lang}/my-spaces`}
      className="cursor-pointer flex items-center"
    >
      <ChevronLeftIcon width={16} height={16} />
      <Text className="text-sm">
        {member ? tNav('home') : tNav('mySpaces')}
      </Text>
    </Link>
  );
}
