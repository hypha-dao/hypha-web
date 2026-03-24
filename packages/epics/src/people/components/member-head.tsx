import { useTranslations } from 'next-intl';
import { Locale } from '@hypha-platform/i18n';
import { Skeleton, Image, Badge } from '@hypha-platform/ui';
import { Text } from '@radix-ui/themes';
import Link from 'next/link';

export type MemberHeadProps = {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  nickname?: string;
  status?: string;
  slug?: string;
  lang: Locale;
  isLoading: boolean;
};

const STATUS_BADGE_VARIANTS = {
  active: { variant: 'surface', colorVariant: 'success' },
  voting: { variant: 'surface', colorVariant: 'warn' },
  completed: { variant: 'surface', colorVariant: 'accent' },
  rejected: { variant: 'surface', colorVariant: 'error' },
  inactive: { variant: 'surface', colorVariant: 'neutral' },
  applicant: { variant: 'surface', colorVariant: 'warn' },
} as const;

const STATUS_BADGE_TRANSLATION_KEYS = {
  active: 'active',
  voting: 'voting',
  completed: 'completed',
  rejected: 'rejected',
  inactive: 'inactive',
  applicant: 'applicant',
} as const;

export const MemberHead = ({
  avatarUrl,
  name,
  surname,
  nickname,
  status,
  slug,
  lang,
  isLoading,
}: MemberHeadProps) => {
  const tMembersTab = useTranslations('MembersTab');
  const normalizedStatus = (status || '').toLowerCase();
  const statusKey = normalizedStatus as keyof typeof STATUS_BADGE_VARIANTS;
  const statusBadgeConfig = STATUS_BADGE_VARIANTS[statusKey] ?? {
    variant: 'surface',
    colorVariant: 'neutral',
  };
  const statusTranslationKey = STATUS_BADGE_TRANSLATION_KEYS[statusKey] as
    | keyof typeof STATUS_BADGE_TRANSLATION_KEYS
    | undefined;
  const statusLabel =
    statusTranslationKey !== undefined
      ? tMembersTab(
          `memberDetail.statusBadge.${statusTranslationKey}` as Parameters<
            typeof tMembersTab
          >[0],
        )
      : status?.trim() || undefined;

  return (
    <div className="flex">
      <Skeleton
        width={'64px'}
        height={'64px'}
        loading={isLoading}
        className="rounded-lg mr-3"
      >
        <Image
          className="rounded-lg mr-3"
          src={avatarUrl || '/placeholder/default-profile.svg'}
          height={64}
          width={64}
          alt={nickname ?? ''}
        />
      </Skeleton>

      <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
          <div className="flex gap-x-1">
            {statusLabel ? (
              <Badge
                isLoading={isLoading}
                variant={statusBadgeConfig.variant}
                colorVariant={statusBadgeConfig.colorVariant}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>

          <Skeleton
            height="26px"
            width="160px"
            loading={isLoading}
            className="my-1"
          >
            <Text className="text-4">
              {name} {surname}
            </Text>
          </Skeleton>

          <Skeleton height="16px" width="80px" loading={isLoading}>
            {slug ? (
              <Link href={`/${lang}/profile/${slug}`}>
                <Text className="text-1 text-neutral-11">@{nickname}</Text>
              </Link>
            ) : (
              <Text className="text-1 text-neutral-11">@{nickname}</Text>
            )}
          </Skeleton>
        </div>
      </div>
    </div>
  );
};
