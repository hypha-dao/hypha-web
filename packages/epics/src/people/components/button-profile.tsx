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
import { TrashIcon, LogOutIcon } from 'lucide-react';
import { ButtonNavItem, ButtonNavItemProps } from '@hypha-platform/ui';
import Link from 'next/link';

export type ButtonProfileProps = {
  avatarSrc?: string;
  userName?: string;
  address?: string;
  isConnected: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  profileUrl?: string;
  navItems: ButtonNavItemProps[];
};

export const ButtonProfile = ({
  avatarSrc,
  userName,
  isConnected,
  address,
  onLogin,
  onLogout,
  onDelete,
  onEdit,
  profileUrl,
  navItems,
}: ButtonProfileProps) => {
  return (
    <div>
      {isConnected ? (
        <>
          {/* Mobile */}
          <div className="flex flex-col justify-center gap-8 md:hidden">
            <div className="flex flex-col items-center gap-2">
              <PersonAvatar
                avatarSrc={avatarSrc}
                userName={userName}
                size="lg"
              />
              <p>{userName}</p>
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

            {onEdit && (
              <ButtonNavItem onClick={onEdit} label="Edit My Profile" />
            )}

            {onDelete && (
              <ButtonNavItem
                onClick={onDelete}
                classNames="text-error-11"
                label="Delete Profile"
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
            <DropdownMenu>
              <DropdownMenuTrigger>
                <PersonAvatar
                  size="md"
                  avatarSrc={avatarSrc}
                  userName={userName}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {profileUrl && (
                  <DropdownMenuItem className="text-1">
                    <Link href={profileUrl}>My Profile</Link>
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit} className="text-1">
                    Edit My Profile
                  </DropdownMenuItem>
                )}
                {address && (
                  <DropdownMenuItem className="text-1 flex justify-between">
                    <EthAddress address={address} />
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-1 text-error-11 flex justify-between"
                  >
                    Delete Profile
                    <TrashIcon className="icon-sm" />
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="text-1 text-error-11 flex justify-between"
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
