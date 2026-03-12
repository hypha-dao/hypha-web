'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { PersonAvatar } from './person-avatar';
import { EthAddress } from './eth-address';
import { TrashIcon, LogOutIcon, Repeat, Shield } from 'lucide-react';
import { ButtonNavItem, ButtonNavItemProps } from '@hypha-platform/ui';
import Link from 'next/link';
import { Person } from '@hypha-platform/core/client';
import { Text } from '@radix-ui/themes';
import { usePrivy, useMfaEnrollment } from '@privy-io/react-auth';
import { useTranslations } from 'next-intl';

export type ButtonProfileProps = {
  address?: string;
  isConnected: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onDelete?: () => void;
  onChangeThemeMode?: () => void;
  profileUrl?: string;
  notificationCentrePath?: string;
  navItems: ButtonNavItemProps[];
  person?: Person;
  resolvedTheme?: string;
};

export const ButtonProfile = ({
  person,
  isConnected,
  address,
  onLogin,
  onLogout,
  onDelete,
  profileUrl,
  notificationCentrePath,
  navItems,
  onChangeThemeMode,
  resolvedTheme,
}: ButtonProfileProps) => {
  const t = useTranslations('Navigation');
  const { user } = usePrivy();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const hasMfaMethods = user && user.mfaMethods && user.mfaMethods.length > 0;
  return (
    <div>
      {isConnected ? (
        <>
          {/* Mobile */}
          <div className="flex flex-col justify-center gap-8 md:hidden">
            <div className="flex flex-col items-center gap-2">
              <PersonAvatar
                avatarSrc={person?.avatarUrl}
                userName={person?.nickname}
                size="lg"
              />
              <p>{person?.nickname}</p>
              {address && (
                <div>
                  <EthAddress address={address} />
                </div>
              )}
            </div>

            {navItems.map((item) => (
              <ButtonNavItem
                key={item.href}
                href={item.href}
                label={item.label}
              />
            ))}

            {profileUrl && (
              <ButtonNavItem href={profileUrl} label={t('myProfile')} />
            )}

            {notificationCentrePath && (
              <ButtonNavItem
                label={t('notificationCentre')}
                href={notificationCentrePath}
              />
            )}

            {/* TODO: It is necessary to implement profile deletion as part of a separate task */}
            {/* {onDelete && (
              <ButtonNavItem
                onClick={onDelete}
                classNames="text-error-11"
                label="Delete"
              />
            )} */}

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
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger>
                <PersonAvatar
                  size="md"
                  avatarSrc={person?.avatarUrl}
                  userName={person?.nickname}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-2 rounded-[6px] min-w-[185px] flex flex-col">
                <Text className="text-2 font-medium text-foreground">
                  {person?.name} {person?.surname}
                </Text>
                {address && (
                  <DropdownMenuItem className="px-0 text-1 flex justify-between">
                    <EthAddress address={address} />
                  </DropdownMenuItem>
                )}
                {profileUrl && (
                  <DropdownMenuItem className="px-0 text-1">
                    <Link className="text-accent-11" href={profileUrl}>
                      {t('viewProfile')}
                    </Link>
                  </DropdownMenuItem>
                )}
                {notificationCentrePath && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="px-0 text-1">
                      <Link
                        className="text-accent-11"
                        href={notificationCentrePath}
                      >
                        {t('notificationCentre')}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                {onChangeThemeMode && (
                  <DropdownMenuItem
                    onClick={onChangeThemeMode}
                    className="px-0 text-1 flex justify-between"
                  >
                    {resolvedTheme === 'dark'
                      ? t('switchToLightMode')
                      : t('switchToDarkMode')}
                    <Repeat className="icon-sm" />
                  </DropdownMenuItem>
                )}
                {hasMfaMethods ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={showMfaEnrollmentModal}
                      className="px-0 text-1"
                    >
                      {t('updateMfa')}
                      <Shield className="icon-sm" />
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={showMfaEnrollmentModal}
                      className="px-0 text-1 flex justify-between"
                    >
                      {t('protectMfa')}
                      <Shield className="icon-sm" />
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="px-0 text-1 flex justify-between"
                    disabled
                  >
                    {t('delete')}
                    <TrashIcon className="icon-sm" />
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="px-0 text-1 text-error-11 flex justify-between"
                >
                  {t('logout')}
                  <LogOutIcon className="icon-sm" />
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
