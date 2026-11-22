'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { useMemberExperience } from './member-experience';

export type MemberTitleScreen =
  | 'signals'
  | 'decisions'
  | 'members'
  | 'treasury'
  | 'wallet'
  | 'messages'
  | 'energy';

type MemberSpacePageTitleProps = {
  /** Builder/funder page name (and member fallback). */
  title: string;
  /**
   * Member screen key — uses small `SCREEN · tagline` + large sentence titles.
   * Street/neighbourhood copy is already community in those strings.
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
}: MemberSpacePageTitleProps) {
  const t = useTranslations('MemberMenu');
  const { isMember } = useMemberExperience();
  const formattedCount = formatCount(count, lang);

  if (isMember) {
    const copy = screen ? memberCopy(t, screen, formattedCount) : null;
    const small = eyebrow ?? copy?.eyebrow ?? null;
    const large = memberTitle ?? copy?.title ?? title;

    return (
      <div className="flex flex-col gap-3" data-member-page-title="">
        {/*
          Fixed min-height keeps the title block from jumping when navigating
          between screens (eyebrow + one title line). Extra title wrap grows down.
        */}
        <header className="craft-page-header flex min-h-[3.75rem] w-full flex-col items-start justify-center gap-1 text-left">
          {small ? (
            <p className="m-0 text-1 font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {small}
            </p>
          ) : (
            <span className="block h-[1.125rem]" aria-hidden />
          )}
          <div className="flex w-full items-start justify-between gap-3">
            <h1 className="craft-page-title m-0 min-h-[2.25rem] text-6 font-medium leading-tight">
              {large}
            </h1>
            {actions ? (
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {actions}
              </div>
            ) : null}
          </div>
        </header>
        {filters ? <div>{filters}</div> : null}
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
