'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { PersonAvatar } from './person-avatar';
import { EthAddress } from './eth-address';

export type ButtonProfileProps = {
  avatarSrc?: string;
  userName?: string;
  address?: string;
  isConnected: boolean;
  login: () => void;
  logout: () => void;
};

export const ButtonProfile = ({
  avatarSrc,
  userName,
  isConnected,
  address,
  login,
  logout,
}: ButtonProfileProps) => {
  return (
    <div>
      {isConnected ? (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <PersonAvatar avatarSrc={avatarSrc} userName={userName} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <EthAddress address={address} />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={login}>Sign in</Button>
      )}
    </div>
  );
};
