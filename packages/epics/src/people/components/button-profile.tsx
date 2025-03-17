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
}: ButtonProfileProps) => {
  return (
    <div>
      {isConnected ? (
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
      ) : (
        <Button onClick={onLogin}>Sign in</Button>
      )}
    </div>
  );
};
