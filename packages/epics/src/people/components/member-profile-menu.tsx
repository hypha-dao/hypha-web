'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bell,
  ChevronRight,
  Globe2,
  Loader2,
  LogOutIcon,
  Moon,
  Sparkles,
  User,
} from 'lucide-react';
import { useSpaceBySlug, type Person } from '@hypha-platform/core/client';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Switch,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { localeMetadata } from '@hypha-platform/i18n/client';

import { useAiPanel } from '../../common/human-chat-panel-context';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { useMemberNamedSpaces } from '../../network-exchange/use-member-named-spaces';
import { PersonAvatar } from './person-avatar';
import { memberSurfaceSpaceQuery, resolveMemberSpaceSlug } from './member-menu';

const menuItemClass =
  'min-h-10 gap-2 rounded-none px-3 py-0 text-2 font-normal font-sans leading-5 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.25] [&_svg]:text-muted-foreground data-[highlighted]:[&_svg]:text-foreground';
const sheetItemClass =
  'flex min-h-10 w-full items-center gap-2 rounded-none px-3 py-0 text-left text-2 font-normal font-sans leading-5 text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.25] [&_svg]:text-muted-foreground';
const separatorClass = 'my-0 h-px bg-border';
const nameClass =
  'truncate text-2 font-medium leading-tight tracking-[-0.02em] text-foreground [font-family:var(--font-family-heading)]';
const metaClass =
  'truncate font-sans text-1 font-normal leading-tight text-muted-foreground';

function useMemberProfileSpaceLabel() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const pathSlug = getDhoSpaceSlugFromPathname(pathname) ?? null;
  const surfaceQuery = memberSurfaceSpaceQuery(
    pathname,
    searchParams.get('space'),
  );
  const named = useMemberNamedSpaces();
  const [recent, setRecent] = useState<string[]>(() => readRecentSpaceSlugs());

  useEffect(() => subscribeRecentSpaceSlugs(setRecent), []);

  const slug = useMemo(
    () =>
      resolveMemberSpaceSlug({
        pathSlug,
        querySlug: surfaceQuery,
        memberSlugs: named.map((space) => space.slug),
        recentSlugs: recent,
      }),
    [named, pathSlug, recent, surfaceQuery],
  );

  const namedMatch = named.find((space) => space.slug === slug);
  const { space } = useSpaceBySlug(slug ?? '');
  // Space title only — locationLabel is often raw lat/long from the map pin.
  return namedMatch?.title ?? space?.title ?? null;
}

type MemberProfileMenuProps = {
  variant: 'dropdown' | 'sheet';
  person?: Person;
  profileUrl?: string;
  notificationCentrePath?: string;
  language?: ReactNode;
  resolvedTheme?: string;
  onChangeThemeMode?: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
  onClose: () => void;
};

export function MemberProfileMenu({
  variant,
  person,
  profileUrl,
  notificationCentrePath,
  language,
  resolvedTheme,
  onChangeThemeMode,
  onLogout,
  loggingOut = false,
  onClose,
}: MemberProfileMenuProps) {
  const t = useTranslations('MemberMenu');
  const tNav = useTranslations('Navigation');
  const tFooter = useTranslations('Footer');
  const locale = useLocale();
  const { openAiPanel, setAiOverlayVisible } = useAiPanel();
  const spaceLabel = useMemberProfileSpaceLabel();
  const displayName = [person?.name, person?.surname].filter(Boolean).join(' ');
  const primaryLine =
    displayName.trim() || person?.nickname || tNav('myProfile');
  const dark = resolvedTheme === 'dark';
  const languageLabel =
    localeMetadata[locale as keyof typeof localeMetadata]?.label ?? locale;

  const openAsk = () => {
    onClose();
    openAiPanel();
    setAiOverlayVisible(false);
  };

  const header = (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <PersonAvatar
        size="md"
        avatarSrc={person?.avatarUrl}
        userName={person?.nickname}
        shape="square"
        className="border-0 shadow-none ring-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={nameClass}>{primaryLine}</span>
        {spaceLabel ? <span className={metaClass}>{spaceLabel}</span> : null}
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-center gap-1.5 px-3 py-3 text-1 text-muted-foreground">
      <span>{tFooter('poweredBy')}</span>
      <span className="font-medium text-foreground">Hypha</span>
    </div>
  );

  if (variant === 'sheet') {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border">{header}</div>
        <div className="flex-1 overflow-y-auto">
          {profileUrl ? (
            <Link
              href={profileUrl}
              className={sheetItemClass}
              onClick={onClose}
            >
              <User className="craft-icon" aria-hidden />
              <span className="flex-1 font-medium">{tNav('viewProfile')}</span>
              <ChevronRight
                className="ml-auto craft-icon opacity-60"
                aria-hidden
              />
            </Link>
          ) : null}
          <button type="button" className={sheetItemClass} onClick={openAsk}>
            <Sparkles className="craft-icon" aria-hidden />
            <span className="flex-1 font-medium">{t('askGuide')}</span>
            <ChevronRight
              className="ml-auto craft-icon opacity-60"
              aria-hidden
            />
          </button>
          {notificationCentrePath ? (
            <Link
              href={notificationCentrePath}
              className={sheetItemClass}
              onClick={onClose}
            >
              <Bell className="craft-icon" aria-hidden />
              <span className="flex-1 font-medium">
                {tNav('notificationCentre')}
              </span>
              <ChevronRight
                className="ml-auto craft-icon opacity-60"
                aria-hidden
              />
            </Link>
          ) : null}
          <div className="border-t border-border" />
          {onChangeThemeMode ? (
            <div className={sheetItemClass}>
              <Moon className="craft-icon" aria-hidden />
              <span className="flex-1 font-medium">{t('darkMode')}</span>
              <Switch
                checked={dark}
                onCheckedChange={() => onChangeThemeMode()}
                aria-label={t('darkMode')}
              />
            </div>
          ) : null}
          {language ? (
            <div
              className={cn(
                sheetItemClass,
                'relative',
                '[&_button[data-language-select-trigger]]:absolute [&_button[data-language-select-trigger]]:inset-0 [&_button[data-language-select-trigger]]:z-10 [&_button[data-language-select-trigger]]:h-full [&_button[data-language-select-trigger]]:w-full [&_button[data-language-select-trigger]]:opacity-0',
              )}
            >
              <Globe2 className="craft-icon" aria-hidden />
              <span className="flex-1 font-medium">{t('language')}</span>
              <span className="text-1 text-muted-foreground">
                {languageLabel}
              </span>
              <ChevronRight className="craft-icon opacity-60" aria-hidden />
              {language}
            </div>
          ) : null}
          <div className="border-t border-border" />
          <button
            type="button"
            className={sheetItemClass}
            onClick={() => {
              onClose();
              onLogout();
            }}
            disabled={loggingOut}
          >
            <LogOutIcon className="craft-icon" aria-hidden />
            <span className="flex-1 font-medium">{t('logOut')}</span>
            {loggingOut ? (
              <Loader2
                className="ml-auto craft-icon animate-spin"
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="ml-auto craft-icon opacity-60"
                aria-hidden
              />
            )}
          </button>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <>
      <DropdownMenuLabel className="cursor-default p-0 font-normal">
        {header}
      </DropdownMenuLabel>
      <DropdownMenuSeparator className={separatorClass} />
      <DropdownMenuGroup>
        {profileUrl ? (
          <DropdownMenuItem className={menuItemClass} asChild>
            <Link href={profileUrl}>
              <User className="craft-icon" aria-hidden />
              <span className="flex-1 font-medium">{tNav('viewProfile')}</span>
              <ChevronRight
                className="ml-auto craft-icon opacity-60"
                aria-hidden
              />
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className={menuItemClass} onSelect={openAsk}>
          <Sparkles className="craft-icon" aria-hidden />
          <span className="flex-1 font-medium">{t('askGuide')}</span>
          <ChevronRight className="ml-auto craft-icon opacity-60" aria-hidden />
        </DropdownMenuItem>
        {notificationCentrePath ? (
          <DropdownMenuItem className={menuItemClass} asChild>
            <Link href={notificationCentrePath}>
              <Bell className="craft-icon" aria-hidden />
              <span className="flex-1 font-medium">
                {tNav('notificationCentre')}
              </span>
              <ChevronRight
                className="ml-auto craft-icon opacity-60"
                aria-hidden
              />
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator className={separatorClass} />
      <DropdownMenuGroup>
        {onChangeThemeMode ? (
          <DropdownMenuItem
            className={menuItemClass}
            onSelect={(event) => {
              event.preventDefault();
            }}
            onClick={(event) => {
              // Keep the menu open; the switch owns the toggle.
              event.preventDefault();
            }}
          >
            <Moon className="craft-icon" aria-hidden />
            <span className="flex-1 font-medium">{t('darkMode')}</span>
            <Switch
              checked={dark}
              onCheckedChange={() => onChangeThemeMode()}
              onClick={(event) => event.stopPropagation()}
              aria-label={t('darkMode')}
            />
          </DropdownMenuItem>
        ) : null}
        {language ? (
          <div
            className={cn(
              menuItemClass,
              'relative flex cursor-default items-center',
              '[&_button[data-language-select-trigger]]:absolute [&_button[data-language-select-trigger]]:inset-0 [&_button[data-language-select-trigger]]:z-10 [&_button[data-language-select-trigger]]:h-full [&_button[data-language-select-trigger]]:w-full [&_button[data-language-select-trigger]]:opacity-0',
            )}
          >
            <Globe2 className="craft-icon" aria-hidden />
            <span className="pointer-events-none flex-1 font-medium">
              {t('language')}
            </span>
            <span className="pointer-events-none text-1 text-muted-foreground">
              {languageLabel}
            </span>
            <ChevronRight
              className="pointer-events-none ml-auto craft-icon opacity-60"
              aria-hidden
            />
            {language}
          </div>
        ) : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator className={separatorClass} />
      <DropdownMenuItem
        className={menuItemClass}
        disabled={loggingOut}
        onSelect={() => onLogout()}
      >
        <LogOutIcon className="craft-icon" aria-hidden />
        <span className="flex-1 font-medium">{t('logOut')}</span>
        {loggingOut ? (
          <Loader2 className="ml-auto craft-icon animate-spin" aria-hidden />
        ) : (
          <ChevronRight className="ml-auto craft-icon opacity-60" aria-hidden />
        )}
      </DropdownMenuItem>
      {footer}
    </>
  );
}
