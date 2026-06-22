'use client';

import { SpaceOrder } from '@hypha-platform/core/client';
import { Combobox } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

import { readClientSearchParams } from '../read-client-search-params';
import { spaceToolbarSortComboboxClassName } from './space-toolbar-styles';

type SpaceOrderComboboxProps = {
  order?: SpaceOrder;
  className?: string;
};

export function SpaceOrderCombobox({
  order,
  className,
}: SpaceOrderComboboxProps) {
  const t = useTranslations('Network');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();

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
      const params = readClientSearchParams(searchParams);
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
    <Combobox
      options={orderOptions}
      initialValue={order}
      triggerVariant="ghost"
      className={cn(spaceToolbarSortComboboxClassName, className)}
      onChange={setOrder}
      allowEmptyChoice={false}
    />
  );
}
