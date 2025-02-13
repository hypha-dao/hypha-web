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
  login: () => void;
  logout: () => void;
  deleteProfile?: () => void;
  transitionToProfile?: () => void;
  transitionToEdit?: () => void;
};

export const ButtonProfile = ({
  avatarSrc,
  userName,
  isConnected,
  address,
  login,
  logout,
  deleteProfile,
  transitionToProfile,
  transitionToEdit,
}: ButtonProfileProps) => {
  return (
    <div>
      {isConnected ? (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <PersonAvatar avatarSrc={avatarSrc} userName={userName} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={transitionToProfile} className='text-1'>
              User profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={transitionToEdit} className='text-1'>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className='text-1 flex justify-between'>
              <EthAddress address={address} hasCopyButton />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={deleteProfile} className='text-1 flex justify-between'>
              Delete
              <TrashIcon className='icon-sm' />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className='text-1 text-error-11 flex justify-between'>
              Logout
              <LogOutIcon className='icon-sm' />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={login}>Sign in</Button>
      )}
    </div>
  );
};
