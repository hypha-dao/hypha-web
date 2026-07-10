'use client';

import { ConnectedButtonProfile as EpicsConnectedButtonProfile } from '@hypha-platform/epics';
import {
  useAuthentication,
  resolvePostAuthRedirectPathOrDefault,
} from '@hypha-platform/authentication';
import { useMe } from '@hypha-platform/core/client';
import type { ComponentProps } from 'react';

type ConnectedButtonProfileProps = Omit<
  ComponentProps<typeof EpicsConnectedButtonProfile>,
  'useAuthentication' | 'useMe' | 'resolvePostAuthRedirectPathOrDefault'
>;

export function ConnectedButtonProfile(props: ConnectedButtonProfileProps) {
  return (
    <EpicsConnectedButtonProfile
      {...props}
      useAuthentication={useAuthentication}
      useMe={useMe}
      resolvePostAuthRedirectPathOrDefault={
        resolvePostAuthRedirectPathOrDefault
      }
    />
  );
}
