'use client';

import type { ReactNode } from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
} from '@hypha-platform/ui';
import { PersonAvatar } from './person-avatar';
import { EthAddress } from './eth-address';
import {
  Bell,
  ChevronRight,
  Compass,
  LogOutIcon,
  Repeat,
  Shield,
  TrashIcon,
  UserRound,
} from 'lucide-react';
import { ButtonNavItem, ButtonNavItemProps } from '@hypha-platform/ui';
import Link from 'next/link';
import { Person } from '@hypha-platform/core/client';
import { usePrivy, useMfaEnrollment } from '@privy-io/react-auth';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@hypha-platform/ui-utils';

export type ButtonProfileProps = {
  address?: string;
  isConnected: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onDelete?: () => void;
  onChangeThemeMode?: () => void;
  profileUrl?: string;
  onboardingUrl?: string;
  notificationCentrePath?: string;
  navItems: ButtonNavItemProps[];
  person?: Person;
  resolvedTheme?: string;
  /** Rendered after main nav links and before the profile avatar (desktop) or profile actions (mobile). */
  trailingBeforeProfile?: ReactNode;
  /** Compact toolbar mode: render profile trigger instead of full mobile column menu. */
  compact?: boolean;
};

const menuItemClass =
  'gap-2 px-2 py-2 text-2 [&_svg]:text-muted-foreground data-[highlighted]:[&_svg]:text-foreground';
const compactSheetItemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-2 text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const ButtonProfile = ({
  person,
  isConnected,
  address,
  onLogin,
  onLogout,
  onDelete,
  profileUrl,
  onboardingUrl,
  notificationCentrePath,
  navItems,
  onChangeThemeMode,
  resolvedTheme,
  trailingBeforeProfile,
  compact = false,
}: ButtonProfileProps) => {
  const t = useTranslations('Navigation');
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const hasMfaMethods = user && user.mfaMethods && user.mfaMethods.length > 0;

  const displayName = [person?.name, person?.surname].filter(Boolean).join(' ');
  const primaryLine = displayName.trim() || person?.nickname || t('myProfile');

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

  if (compact) {
    if (!isConnected) {
      return (
        <Button className="h-10" onClick={onLogin}>
          {t('signIn')}
        </Button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {trailingBeforeProfile}
        <Sheet open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
          <button
            type="button"
            className={cn(
              'box-border flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center',
              'isolate overflow-hidden rounded-md bg-neutral-1 p-0 text-neutral-12 outline-none',
              'shadow-sm transition-colors duration-150',
              'hover:text-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
            aria-label={t('openProfileMenu')}
            aria-haspopup="dialog"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen(true)}
          >
            <PersonAvatar
              size="toolbar"
              avatarSrc={person?.avatarUrl}
              userName={person?.nickname}
              shape="rounded"
              className="h-full w-full rounded-md ring-0"
            />
          </button>
          <SheetContent
            side="right"
            closeLabel="Close"
            className={cn(
              'w-[calc(100vw-1rem)] max-w-[560px] border-l border-border/80 p-0',
              'bg-popover text-popover-foreground shadow-xl',
            )}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-border/60 px-4 pb-4 pt-5">
                <div className="flex gap-3">
                  <PersonAvatar
                    size="md"
                    avatarSrc={person?.avatarUrl}
                    userName={person?.nickname}
                    shape="rounded"
                    className="ring-1 ring-border/60"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pr-8">
                    <span className="truncate text-2 font-semibold leading-snug text-foreground">
                      {primaryLine}
                    </span>
                    {displayName.trim() && person?.nickname ? (
                      <span className="truncate text-1 text-muted-foreground">
                        {person.nickname}
                      </span>
                    ) : null}
                  </div>
                </div>
                {address ? (
                  <div className="mt-3 w-full rounded-md border border-border/50 bg-muted/35 px-2 py-1.5 text-1 text-muted-foreground">
                    <EthAddress address={address} />
                  </div>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-2">
                <div className="space-y-1">
                  {navItems.map((item) =>
                    item.href ? (
                      <Link
                        key={`${item.label}-${String(item.href)}`}
                        href={item.href}
                        className={compactSheetItemClass}
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight
                          className="ml-auto size-4 text-muted-foreground"
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      <button
                        key={`nav-action-${item.label}`}
                        type="button"
                        className={compactSheetItemClass}
                        onClick={(event) => {
                          setProfileMenuOpen(false);
                          item.onClick?.(event);
                        }}
                      >
                        <span className="flex-1">{item.label}</span>
                      </button>
                    ),
                  )}
                  {profileUrl ? (
                    <Link
                      href={profileUrl}
                      className={compactSheetItemClass}
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <UserRound className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{t('viewProfile')}</span>
                      <ChevronRight
                        className="ml-auto size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  ) : null}
                  {onboardingUrl ? (
                    <Link
                      href={onboardingUrl}
                      className={compactSheetItemClass}
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <Compass className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{t('continueAdventure')}</span>
                      <ChevronRight
                        className="ml-auto size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  ) : null}
                  {notificationCentrePath ? (
                    <Link
                      href={notificationCentrePath}
                      className={compactSheetItemClass}
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <Bell className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{t('notificationCentre')}</span>
                      <ChevronRight
                        className="ml-auto size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  ) : null}
                </div>

                <div className="my-2 border-t border-border/60" />

                <div className="space-y-1">
                  {onChangeThemeMode ? (
                    <button
                      type="button"
                      className={compactSheetItemClass}
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onChangeThemeMode();
                      }}
                    >
                      <span className="flex-1">
                        {resolvedTheme === 'dark'
                          ? t('switchToLightMode')
                          : t('switchToDarkMode')}
                      </span>
                      <Repeat className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className={compactSheetItemClass}
                    onClick={() => {
                      setProfileMenuOpen(false);
                      showMfaEnrollmentModal();
                    }}
                  >
                    <span className="flex-1">
                      {hasMfaMethods ? t('updateMfa') : t('protectMfa')}
                    </span>
                    <Shield className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </div>

                <div className="my-2 border-t border-border/60" />

                <div className="space-y-1">
                  {onDelete ? (
                    <button
                      type="button"
                      className={cn(
                        compactSheetItemClass,
                        'text-error-11 hover:bg-error-3/40',
                      )}
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onDelete();
                      }}
                      disabled
                    >
                      <span className="flex-1">{t('delete')}</span>
                      <TrashIcon className="size-4 shrink-0 text-error-11" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className={cn(
                      compactSheetItemClass,
                      'text-error-11 hover:bg-error-3/40',
                    )}
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <span className="flex-1">{t('logout')}</span>
                    <LogOutIcon className="size-4 shrink-0 text-error-11" />
                  </button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div>
      {isConnected ? (
        <>
          {/* Mobile */}
          <div className="flex flex-col justify-center gap-6 md:hidden">
            <div
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border border-border/80',
                'bg-popover px-4 py-5 text-popover-foreground shadow-sm',
              )}
            >
              <PersonAvatar
                avatarSrc={person?.avatarUrl}
                userName={person?.nickname}
                size="lg"
                shape="rounded"
              />
              <div className="flex flex-col items-center gap-0.5 text-center">
                <p className="text-2 font-semibold leading-snug text-foreground">
                  {primaryLine}
                </p>
                {displayName.trim() && person?.nickname ? (
                  <p className="text-1 text-muted-foreground">
                    {person.nickname}
                  </p>
                ) : null}
              </div>
              {address ? (
                <div className="w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                  <EthAddress address={address} />
                </div>
              ) : null}
            </div>

            {navItems.map((item) => (
              <ButtonNavItem
                key={item.href}
                href={item.href}
                label={item.label}
              />
            ))}

            {trailingBeforeProfile ? (
              <div className="flex w-full justify-center">
                {trailingBeforeProfile}
              </div>
            ) : null}

            {profileUrl && (
              <ButtonNavItem href={profileUrl} label={t('myProfile')} />
            )}

            {onboardingUrl && (
              <ButtonNavItem
                href={onboardingUrl}
                label={t('continueAdventure')}
              />
            )}

            {notificationCentrePath && (
              <ButtonNavItem
                label={t('notificationCentre')}
                href={notificationCentrePath}
              />
            )}

            <ButtonNavItem
              onClick={onChangeThemeMode}
              label={
                resolvedTheme === 'dark'
                  ? t('switchToLightMode')
                  : t('switchToDarkMode')
              }
            />

            {hasMfaMethods ? (
              <ButtonNavItem
                onClick={showMfaEnrollmentModal}
                label={t('updateMfa')}
              />
            ) : (
              <ButtonNavItem
                onClick={showMfaEnrollmentModal}
                label={t('protectMfa')}
              />
            )}

            <ButtonNavItem
              onClick={onLogout}
              classNames="text-error-11"
              label={t('logout')}
            />
          </div>

          {/* Desktop */}
          <div className="hidden md:flex gap-2">
            <div className="flex gap-2">
              {navItems.map((item) => (
                <ButtonNavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                />
              ))}
            </div>
            {trailingBeforeProfile}
            <DropdownMenu
              open={profileMenuOpen}
              onOpenChange={setProfileMenuOpen}
              modal={false}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    /* Match LanguageSelect trigger: h-10 toolbar row, square hit target */
                    'box-border flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center',
                    'isolate overflow-hidden rounded-md bg-neutral-1 p-0 text-neutral-12 outline-none',
                    'shadow-sm transition-colors duration-150',
                    'hover:text-foreground',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'data-[state=open]:shadow-md',
                  )}
                  aria-label={t('openProfileMenu')}
                  aria-haspopup="menu"
                >
                  <PersonAvatar
                    size="toolbar"
                    avatarSrc={person?.avatarUrl}
                    userName={person?.nickname}
                    shape="rounded"
                    className="h-full w-full rounded-md ring-0"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                className={cn(
                  'w-[min(17.5rem,calc(100vw-1.5rem))] border border-border/90 p-1',
                  'bg-popover text-popover-foreground shadow-xl',
                )}
              >
                <DropdownMenuLabel className="cursor-default px-2 pb-0 pt-1.5 font-normal">
                  <div className="flex gap-3">
                    <PersonAvatar
                      size="md"
                      avatarSrc={person?.avatarUrl}
                      userName={person?.nickname}
                      shape="rounded"
                      className="ring-1 ring-border/60"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-2 font-semibold leading-snug text-foreground">
                        {primaryLine}
                      </span>
                      {displayName.trim() && person?.nickname ? (
                        <span className="truncate text-1 text-muted-foreground">
                          {person.nickname}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </DropdownMenuLabel>
                {address ? (
                  <div className="mt-2 w-full border-t border-border/50 pt-2 pb-1">
                    <div
                      className={cn(
                        'w-full rounded-md border border-border/50 bg-muted/35 px-2 py-1.5',
                        'text-1 text-muted-foreground',
                      )}
                    >
                      <EthAddress address={address} />
                    </div>
                  </div>
                ) : null}

                {(profileUrl || onboardingUrl || notificationCentrePath) && (
                  <>
                    <DropdownMenuSeparator className="-mx-0 my-1" />
                    <DropdownMenuGroup className="space-y-0.5">
                      {profileUrl ? (
                        <DropdownMenuItem className={menuItemClass} asChild>
                          <Link href={profileUrl}>
                            <UserRound
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                            <span className="flex-1">{t('viewProfile')}</span>
                            <ChevronRight
                              className="ml-auto size-4 opacity-60"
                              aria-hidden
                            />
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      {onboardingUrl ? (
                        <DropdownMenuItem className={menuItemClass} asChild>
                          <Link href={onboardingUrl}>
                            <Compass className="size-4 shrink-0" aria-hidden />
                            <span className="flex-1">
                              {t('continueAdventure')}
                            </span>
                            <ChevronRight
                              className="ml-auto size-4 opacity-60"
                              aria-hidden
                            />
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      {notificationCentrePath ? (
                        <DropdownMenuItem className={menuItemClass} asChild>
                          <Link href={notificationCentrePath}>
                            <Bell className="size-4 shrink-0" aria-hidden />
                            <span className="flex-1">
                              {t('notificationCentre')}
                            </span>
                            <ChevronRight
                              className="ml-auto size-4 opacity-60"
                              aria-hidden
                            />
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuGroup>
                  </>
                )}

                <DropdownMenuSeparator className="-mx-0 my-1" />

                <DropdownMenuGroup className="space-y-0.5">
                  {onChangeThemeMode ? (
                    <DropdownMenuItem
                      className={menuItemClass}
                      onClick={onChangeThemeMode}
                    >
                      <span className="flex-1">
                        {resolvedTheme === 'dark'
                          ? t('switchToLightMode')
                          : t('switchToDarkMode')}
                      </span>
                      <Repeat className="size-4 shrink-0" aria-hidden />
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className={menuItemClass}
                    onClick={showMfaEnrollmentModal}
                  >
                    <span className="flex-1">
                      {hasMfaMethods ? t('updateMfa') : t('protectMfa')}
                    </span>
                    <Shield className="size-4 shrink-0" aria-hidden />
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                {onDelete ? (
                  <>
                    <DropdownMenuSeparator className="-mx-0 my-1" />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className={cn(
                        menuItemClass,
                        'text-error-11 focus:text-error-11',
                      )}
                      disabled
                    >
                      <span className="flex-1">{t('delete')}</span>
                      <TrashIcon className="size-4 shrink-0" aria-hidden />
                    </DropdownMenuItem>
                  </>
                ) : null}

                <DropdownMenuSeparator className="-mx-0 my-1" />

                <DropdownMenuItem
                  onClick={onLogout}
                  className={cn(
                    menuItemClass,
                    'text-error-11 focus:bg-error-3 focus:text-error-12 data-[highlighted]:bg-error-3',
                  )}
                >
                  <span className="flex-1">{t('logout')}</span>
                  <LogOutIcon className="size-4 shrink-0" aria-hidden />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <div className="flex flex-col md:flex-row gap-8 md:gap-2">
          {navItems.map((item) => (
            <ButtonNavItem
              key={item.href}
              href={item.href}
              label={item.label}
            />
          ))}
          {trailingBeforeProfile}
          <Button onClick={onLogin}>{t('signIn')}</Button>
          <Button
            className="hidden md:flex"
            variant="outline"
            onClick={onLogin}
          >
            {t('getStarted')}
          </Button>
        </div>
      )}
    </div>
  );
};
