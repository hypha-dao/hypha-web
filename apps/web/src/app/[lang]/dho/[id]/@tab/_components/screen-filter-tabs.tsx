'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';

type ScreenFilterTabItem = {
  value: string;
  label: string;
};

type ScreenFilterTabsProps = {
  queryKey: string;
  defaultValue: string;
  items: ScreenFilterTabItem[];
};

export function ScreenFilterTabs({
  queryKey,
  defaultValue,
  items,
}: ScreenFilterTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentValue = useMemo(() => {
    const raw = searchParams.get(queryKey);
    if (!raw) return defaultValue;
    return items.some((item) => item.value === raw) ? raw : defaultValue;
  }, [defaultValue, items, queryKey, searchParams]);

  const handleValueChange = (nextValue: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextValue === defaultValue) {
      nextParams.delete(queryKey);
    } else {
      nextParams.set(queryKey, nextValue);
    }
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <Tabs value={currentValue} onValueChange={handleValueChange}>
      <TabsList triggerVariant="switch" className="w-fit">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} variant="switch">
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
