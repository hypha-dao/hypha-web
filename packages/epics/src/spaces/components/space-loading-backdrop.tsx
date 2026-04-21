'use client';

import * as React from 'react';
import { LoadingBackdrop, type LoadingBackdropProps } from '@hypha-platform/ui';
import { useSpaceAccentPortalStyles } from './space-accent-portal-context';

/**
 * Same as {@link LoadingBackdrop}, but when the overlay is portaled to `document.body`
 * it re-applies the current space accent CSS variables so `bg-accent-9` (progress bar)
 * matches the DHO space palette.
 */
export function SpaceLoadingBackdrop(props: LoadingBackdropProps) {
  const portalScopeStyle = useSpaceAccentPortalStyles();
  return <LoadingBackdrop {...props} portalScopeStyle={portalScopeStyle} />;
}
