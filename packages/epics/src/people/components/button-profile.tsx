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

export type ButtonProfileProps = {
  address?: string;
  isConnected: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onDelete?: () => void;
  onChangeThemeMode?: () => void;
  profileUrl?: string;
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
  navItems,
  onChangeThemeMode,
  resolvedTheme,
}: ButtonProfileProps) => {
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
              <ButtonNavItem href={profileUrl} label="My Profile" />
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
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
            />

            {hasMfaMethods ? (
              <ButtonNavItem
                onClick={showMfaEnrollmentModal}
                label={'Update funds protection (MFA)'}
              />
            ) : (
              <ButtonNavItem
                onClick={showMfaEnrollmentModal}
                label={'Protect funds (MFA)'}
              />
            )}

            <ButtonNavItem
              onClick={onLogout}
              classNames="text-error-11"
              label="Logout"
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
                      View profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onChangeThemeMode && (
                  <DropdownMenuItem
                    onClick={onChangeThemeMode}
                    className="px-0 text-1 flex justify-between"
                  >
                    {resolvedTheme === 'dark'
                      ? 'Switch to light mode'
                      : 'Switch to dark mode'}
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
                      Update funds protection (MFA)
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
                      Protect funds (MFA)
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
                    Delete
                    <TrashIcon className="icon-sm" />
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="px-0 text-1 text-error-11 flex justify-between"
                >
                  Logout
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
          <Button onClick={onLogin}>Sign in</Button>
          <Button
            className="hidden md:flex"
            variant="outline"
            onClick={onLogin}
          >
            Get started
          </Button>
        </div>
      )}
    </div>
  );
};
