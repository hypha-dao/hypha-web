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
import { ButtonNavItem, ButtonNavItemProps } from "@hypha-platform/ui";

export type ButtonProfileProps = {
  avatarSrc?: string;
  userName?: string;
  address?: string;
  isConnected: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onProfile?: () => void;
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
  onProfile,
  navItems
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

            {onProfile && (
              <Button className="bg-transparent text-gray-400"  onClick={onProfile}>
                My Profile
              </Button>
            )}

            {onEdit && (
              <Button className="bg-transparent text-gray-400" onClick={onProfile}>
                Edit My Profile
              </Button>
            )}

            {onDelete && (
              <Button
                onClick={onDelete}
                className="bg-transparent text-error-11"
              >
                Delete Profile
              </Button>
            )}

             <Button
              onClick={onLogout}
              className="bg-transparent text-error-11"
            >
              Logout
            </Button>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex">
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
                <PersonAvatar size="md" avatarSrc={avatarSrc} userName={userName} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {onProfile && (
                  <DropdownMenuItem onClick={onProfile} className="text-1">
                    My Profile
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={onProfile} className="text-1">
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
          <Button className="hidden md:flex" variant="outline" onClick={onLogin}>
            Get started
          </Button>
        </div>
      )}
    </div>
  );
};
