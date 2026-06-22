'use client';

import { SpaceOrder } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { useAuthentication } from '@hypha-platform/authentication';
import React from 'react';

import { CreateSpaceButton } from './create-space-button';
import { SpaceSearch } from './space-search';
import { spaceToolbarPrimaryButtonClassName } from './space-toolbar-styles';

type MySpacesControlsProps = {
  lang: Locale;
  query?: string;
  order?: SpaceOrder;
  showCreateButton?: boolean;
};

export function MySpacesControls({
  lang,
  query,
  showCreateButton = false,
}: MySpacesControlsProps) {
  const { isAuthenticated } = useAuthentication();

  return (
    <div className="flex w-full min-w-0 flex-row items-center gap-3">
      <SpaceSearch value={query} className="min-w-0 flex-1" />
      {showCreateButton ? (
        <CreateSpaceButton
          lang={lang}
          isAuthenticated={isAuthenticated}
          className="min-w-0 shrink-0 sm:ml-auto"
          buttonClassName={spaceToolbarPrimaryButtonClassName}
        />
      ) : null}
    </div>
  );
}
