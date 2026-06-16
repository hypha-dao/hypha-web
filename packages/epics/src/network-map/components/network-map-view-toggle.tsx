'use client';

import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

export type NetworkMapView = 'list' | 'map';

type NetworkMapViewToggleProps = {
  value: NetworkMapView;
  onChange: (view: NetworkMapView) => void;
  className?: string;
};

export function NetworkMapViewToggle({
  value,
  onChange,
  className,
}: NetworkMapViewToggleProps) {
  const t = useTranslations('NetworkMap');

  return (
    <div
      className={cn(
        'inline-flex rounded-md border border-neutral-6 bg-neutral-2 p-0.5',
        className,
      )}
      role="group"
      aria-label={t('viewToggleLabel')}
    >
      <button
        type="button"
        className={cn(
          'rounded px-3 py-1.5 text-sm transition-colors',
          value === 'list'
            ? 'bg-accent-9 text-white'
            : 'text-neutral-11 hover:bg-neutral-4',
        )}
        onClick={() => onChange('list')}
      >
        {t('listView')}
      </button>
      <button
        type="button"
        className={cn(
          'rounded px-3 py-1.5 text-sm transition-colors',
          value === 'map'
            ? 'bg-accent-9 text-white'
            : 'text-neutral-11 hover:bg-neutral-4',
        )}
        onClick={() => onChange('map')}
      >
        {t('mapView')}
      </button>
    </div>
  );
}
