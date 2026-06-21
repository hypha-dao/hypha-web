'use client';

import { SpaceOrder } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Combobox } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

import { CreateSpaceButton } from './create-space-button';
import { SpaceSearch } from './space-search';

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

  const createSpaceButtonClassName =
    'h-8 min-h-8 gap-1 px-2 text-xs whitespace-nowrap sm:h-10 sm:min-h-10 sm:gap-2 sm:px-4 sm:text-sm';

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3">
      <SpaceSearch value={query} className="min-w-0 flex-1" />
      <Combobox
        options={orderOptions}
        initialValue={order}
        triggerVariant="ghost"
        className="h-9 w-fit shrink-0 justify-start px-0 font-normal md:w-fit"
        onChange={setOrder}
        allowEmptyChoice={false}
      />
      {showCreateButton ? (
        <CreateSpaceButton
          lang={lang}
          isAuthenticated={isAuthenticated}
          className="min-w-0 shrink-0"
          buttonClassName={createSpaceButtonClassName}
        />
      ) : null}
    </div>
  );
}
