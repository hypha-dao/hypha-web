'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Coins,
  FileCheck2,
  MessagesSquare,
  Radio,
  UserRound,
  UsersRound,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { useMemberExperience } from './member-experience';
import { MemberEyebrow } from './member-eyebrow';
import { MEMBER_PAGE_TITLE, MEMBER_TITLE_STACK } from './member-type';

export type MemberTitleScreen =
  | 'signals'
  | 'decisions'
  | 'members'
  | 'treasury'
  | 'wallet'
  | 'messages'
  | 'energy'
  | 'profile';

const SCREEN_ICONS: Record<MemberTitleScreen, LucideIcon> = {
  signals: Radio,
  decisions: FileCheck2,
  members: UsersRound,
  treasury: Coins,
  wallet: Wallet,
  messages: MessagesSquare,
  energy: Zap,
  profile: UserRound,
};

type MemberSpacePageTitleProps = {
  /** Builder/funder page name (and member fallback). */
  title: string;
  /**
   * Member screen key — uses small `SCREEN · tagline` + large sentence titles.
   * Space-facing copy lives in MemberMenu.titles.
   */
  screen?: MemberTitleScreen;
  count?: number | null;
  lang?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  /** Override the small label (e.g. space name on home). */
  eyebrow?: string;
  /** Override the large member title. */
  memberTitle?: string;
  /** Override the eyebrow icon (defaults from `screen`). */
  eyebrowIcon?: LucideIcon | null;
};

function formatCount(count?: number | null, lang?: string): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return null;
  }
  return Intl.NumberFormat(lang).format(count);
}

function memberCopy(
  t: ReturnType<typeof useTranslations<'MemberMenu'>>,
  screen: MemberTitleScreen,
  formattedCount: string | null,
): { eyebrow: string; title: string } {
  switch (screen) {
    case 'signals':
      return {
        eyebrow: t('titles.signalsEyebrow'),
        title: t('titles.signalsTitle'),
      };
    case 'decisions':
      return {
        eyebrow: t('titles.decisionsEyebrow'),
        title: t('titles.decisionsTitle'),
      };
    case 'members':
      return {
        eyebrow: formattedCount
          ? t('titles.membersEyebrow', { count: formattedCount })
          : t('members'),
        title: t('titles.membersTitle'),
      };
    case 'treasury':
      return {
        eyebrow: t('titles.treasuryEyebrow'),
        title: t('titles.treasuryTitle'),
      };
    case 'wallet':
      return {
        eyebrow: t('titles.walletEyebrow'),
        title: t('titles.walletTitle'),
      };
    case 'messages':
      return {
        eyebrow: t('titles.messagesEyebrow'),
        title: t('titles.messagesTitle'),
      };
    case 'energy':
      return {
        eyebrow: t('titles.energyEyebrow'),
        title: t('titles.energyTitle'),
      };
    case 'profile':
      return {
        eyebrow: t('titles.profileEyebrow'),
        title: t('titles.profileTitle'),
      };
  }
}

/**
 * Members: small uppercase screen label + large title sentence.
 * Builders and funders: single craft page title (optional count).
 */
export function MemberSpacePageTitle({
  title,
  screen,
  count,
  lang,
  actions,
  filters,
  eyebrow,
  memberTitle,
  eyebrowIcon,
}: MemberSpacePageTitleProps) {
  const t = useTranslations('MemberMenu');
  const { isMember } = useMemberExperience();
  const formattedCount = formatCount(count, lang);

  if (isMember) {
    const copy = screen ? memberCopy(t, screen, formattedCount) : null;
    const small = eyebrow ?? copy?.eyebrow ?? null;
    const large = memberTitle ?? copy?.title ?? title;
    const Icon =
      eyebrowIcon === null
        ? null
        : eyebrowIcon ?? (screen ? SCREEN_ICONS[screen] : null);

    return (
      <div className="w-full min-w-0" data-member-page-title="">
        {/*
          Natural height + shared MEMBER_TITLE_STACK — no min-height /
          justify-center (those made top/bottom padding jump per screen).
          Space below comes from MEMBER_SCREEN_STACK gap-4.
        */}
        <header className={MEMBER_TITLE_STACK}>
          {small ? <MemberEyebrow icon={Icon}>{small}</MemberEyebrow> : null}
          <div className="flex w-full items-start justify-between gap-3">
            <h1 className={MEMBER_PAGE_TITLE}>{large}</h1>
            {actions ? (
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {actions}
              </div>
            ) : null}
          </div>
        </header>
        {filters ? <div className="mt-4">{filters}</div> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="craft-page-header flex w-full items-start justify-between gap-3 text-left">
        <h1 className="craft-page-title m-0 text-6 font-medium">
          {title}
          {formattedCount ? (
            <span className="ml-2 text-4 font-normal text-muted-foreground">
              | {formattedCount}
            </span>
          ) : null}
        </h1>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {actions}
          </div>
        ) : null}
      </header>
      {filters ? <div>{filters}</div> : null}
    </div>
  );
}
