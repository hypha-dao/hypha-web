'use client';

import { SpaceOrder } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Combobox } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

import { CreateSpaceButton } from './create-space-button';
import { SpaceSearch } from './space-search';
import {
  spaceToolbarPrimaryButtonClassName,
  spaceToolbarSortComboboxClassName,
} from './space-toolbar-styles';

type MySpacesControlsProps = {
  lang: Locale;
  query?: string;
  order?: SpaceOrder;
  showCreateButton?: boolean;
};

export function MySpacesControls({
  lang,
  query,
  order,
  showCreateButton = false,
}: MySpacesControlsProps) {
  const t = useTranslations('Network');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const { isAuthenticated } = useAuthentication();

  const orderOptions: {
    value: SpaceOrder;
    label: string;
    searchText: string;
  }[] = [
    {
      value: 'mostmembers',
      label: t('mostMembers'),
      searchText: t('mostMembers'),
    },
    {
      value: 'mostagreements',
      label: t('mostAgreements'),
      searchText: t('mostAgreements'),
    },
    {
      value: 'mostrecent',
      label: t('mostRecent'),
      searchText: t('mostRecent'),
    },
  ];

  const setOrder = React.useCallback(
    (nextOrder: string) => {
      const params = new URLSearchParams(searchParams);
      if (nextOrder) {
        params.set('order', nextOrder);
      } else {
        params.delete('order');
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [pathname, replace, searchParams],
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex w-full min-w-0 items-center gap-2 sm:contents">
        <SpaceSearch value={query} className="min-w-0 flex-1 sm:order-1" />
        {showCreateButton ? (
          <CreateSpaceButton
            lang={lang}
            isAuthenticated={isAuthenticated}
            className="min-w-0 shrink-0 sm:ml-auto sm:order-3"
            buttonClassName={spaceToolbarPrimaryButtonClassName}
          />
        ) : null}
      </div>
      <Combobox
        options={orderOptions}
        initialValue={order}
        triggerVariant="ghost"
        className={cn(spaceToolbarSortComboboxClassName, 'sm:order-2')}
        onChange={setOrder}
        allowEmptyChoice={false}
      />
    </div>
  );
}
