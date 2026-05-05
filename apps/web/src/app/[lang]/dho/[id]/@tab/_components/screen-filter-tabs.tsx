'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { useFormatter } from 'next-intl';

type ScreenFilterTabItem = {
  value: string;
  label: string;
  count?: number | null;
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
  const format = useFormatter();
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
            <span className="inline-flex items-center gap-1">
              <span>{item.label}</span>
              {typeof item.count === 'number' && Number.isFinite(item.count) ? (
                <span className="text-xs text-muted-foreground">
                  ({format.number(item.count)})
                </span>
              ) : null}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
