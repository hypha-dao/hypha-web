'use client';

import {
  type GeocodeResult,
  parseCoordinateInput,
  roundCoordinate,
  type SpaceLocationSource,
  useGeocodeSearch,
} from '@hypha-platform/core/client';
import { Button, FormLabel, Input, Label } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import * as d3 from 'd3';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { loadLandGeo } from '../../network-map/lib/load-land-geo';

export type SpaceLocationValue = {
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  locationSource: SpaceLocationSource | null;
};

export type SpaceLocationPickerHandle = {
  commitPendingCoordinates: () => SpaceLocationValue;
};

type SpaceLocationPickerProps = {
  value: SpaceLocationValue;
  onChange: (value: SpaceLocationValue) => void;
  disabled?: boolean;
};

const MAP_WIDTH = 360;
const MAP_HEIGHT = 180;

function coordsFromMapClick(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { latitude: number; longitude: number } {
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  const latitude = 90 - (y / rect.height) * 180;
  const longitude = (x / rect.width) * 360 - 180;
  return {
    latitude: Math.round(latitude * 1e5) / 1e5,
    longitude: Math.round(longitude * 1e5) / 1e5,
  };
}

function projectToMap(latitude: number, longitude: number) {
  const x = ((longitude + 180) / 360) * MAP_WIDTH;
  const y = ((90 - latitude) / 180) * MAP_HEIGHT;
  return { x, y };
}

export const SpaceLocationPicker = React.forwardRef<
  SpaceLocationPickerHandle,
  SpaceLocationPickerProps
>(function SpaceLocationPicker({ value, onChange, disabled = false }, ref) {
  const t = useTranslations('SpaceLocation');
  const mapRef = React.useRef<HTMLDivElement>(null);
  const { query, setQuery, results, isSearching, error } = useGeocodeSearch();
  const [landPath, setLandPath] = React.useState<string | null>(null);
  const [isLoadingLand, setIsLoadingLand] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    loadLandGeo()
      .then((land) => {
        if (cancelled) {
          return;
        }
        const projection = d3.geoEquirectangular().fitExtent(
          [
            [0, 0],
            [MAP_WIDTH, MAP_HEIGHT],
          ],
          land,
        );
        const path = d3.geoPath(projection);
        setLandPath(path(land) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setLandPath(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingLand(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hasPin =
    value.latitude != null &&
    value.longitude != null &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude);

  const pinPosition = hasPin
    ? projectToMap(value.latitude!, value.longitude!)
    : null;

  const applySelection = React.useCallback(
    (
      latitude: number,
      longitude: number,
      locationLabel: string,
      locationSource: SpaceLocationSource,
    ) => {
      onChange({
        latitude: roundCoordinate(latitude),
        longitude: roundCoordinate(longitude),
        locationLabel,
        locationSource,
      });
    },
    [onChange],
  );

  const handleMapClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !mapRef.current) return;
      const { latitude, longitude } = coordsFromMapClick(
        event.clientX,
        event.clientY,
        mapRef.current.getBoundingClientRect(),
      );
      applySelection(
        latitude,
        longitude,
        t('mapClickLabel', { latitude, longitude }),
        'map_click',
      );
    },
    [applySelection, disabled, t],
  );

  const handleSelectResult = React.useCallback(
    (result: GeocodeResult) => {
      applySelection(
        result.latitude,
        result.longitude,
        result.label,
        'geocode',
      );
      setQuery(result.label);
    },
    [applySelection, setQuery],
  );

  const [latInput, setLatInput] = React.useState(
    value.latitude != null ? String(value.latitude) : '',
  );
  const [lngInput, setLngInput] = React.useState(
    value.longitude != null ? String(value.longitude) : '',
  );
  const [manualError, setManualError] = React.useState<string | null>(null);
  const hasSyncedSearchQuery = React.useRef(false);

  const commitPendingCoordinates = React.useCallback((): SpaceLocationValue => {
    const lat = parseCoordinateInput(latInput);
    const lng = parseCoordinateInput(lngInput);
    const latEmpty = latInput.trim() === '';
    const lngEmpty = lngInput.trim() === '';

    if (latEmpty && lngEmpty) {
      setManualError(null);
      return value;
    }

    if (lat == null || lng == null) {
      setManualError(t('manualCoordinateInvalid'));
      return value;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setManualError(t('manualCoordinateOutOfRange'));
      return value;
    }

    setManualError(null);
    const next: SpaceLocationValue = {
      latitude: roundCoordinate(lat),
      longitude: roundCoordinate(lng),
      locationLabel: t('manualLabel', { latitude: lat, longitude: lng }),
      locationSource: 'manual',
    };

    const hasChanged =
      next.latitude !== value.latitude ||
      next.longitude !== value.longitude ||
      next.locationLabel !== value.locationLabel ||
      next.locationSource !== value.locationSource;

    if (hasChanged) {
      onChange(next);
    }

    return next;
  }, [latInput, lngInput, onChange, t, value]);

  React.useImperativeHandle(
    ref,
    () => ({
      commitPendingCoordinates,
    }),
    [commitPendingCoordinates],
  );

  const handleManualCoordinates = React.useCallback(() => {
    commitPendingCoordinates();
  }, [commitPendingCoordinates]);

  React.useEffect(() => {
    setLatInput(value.latitude != null ? String(value.latitude) : '');
    setLngInput(value.longitude != null ? String(value.longitude) : '');
    setManualError(null);
  }, [value.latitude, value.longitude]);

  React.useEffect(() => {
    if (!hasSyncedSearchQuery.current) {
      setQuery(value.locationLabel ?? '');
      hasSyncedSearchQuery.current = true;
    }
  }, [setQuery, value.locationLabel]);

  const showNoResults =
    query.trim().length >= 2 && !isSearching && !error && results.length === 0;

  const clearLocation = React.useCallback(() => {
    onChange({
      latitude: null,
      longitude: null,
      locationLabel: null,
      locationSource: null,
    });
    setQuery('');
    setLatInput('');
    setLngInput('');
    setManualError(null);
    hasSyncedSearchQuery.current = false;
  }, [onChange, setQuery]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FormLabel className="text-foreground">{t('sectionTitle')}</FormLabel>
        <p className="text-1 text-neutral-11 mt-1">{t('privacyNote')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="space-location-search">{t('searchLabel')}</Label>
        <div className="relative">
          <Input
            id="space-location-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            disabled={disabled}
            autoComplete="off"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        {error ? (
          <p className="text-1 text-error-11" role="alert">
            {t('searchError')}
          </p>
        ) : null}
        {showNoResults ? (
          <p className="text-1 text-neutral-11">{t('searchNoResults')}</p>
        ) : null}
        {results.length > 0 ? (
          <ul
            className="border border-border rounded-md bg-background max-h-48 overflow-y-auto"
            aria-label={t('resultsLabel')}
          >
            {results.map((result, index) => (
              <li
                key={`${index}-${result.placeId ?? 'no-place'}-${
                  result.label
                }-${result.latitude}-${result.longitude}`}
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-8"
                  onClick={() => handleSelectResult(result)}
                  disabled={disabled}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('mapLabel')}</Label>
        <div
          ref={mapRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={t('mapAriaLabel')}
          onClick={handleMapClick}
          onKeyDown={(event) => {
            if (disabled || (event.key !== 'Enter' && event.key !== ' ')) {
              return;
            }
            event.preventDefault();
            if (!mapRef.current) return;
            const rect = mapRef.current.getBoundingClientRect();
            const { latitude, longitude } = coordsFromMapClick(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
              rect,
            );
            applySelection(
              latitude,
              longitude,
              t('mapClickLabel', { latitude, longitude }),
              'map_click',
            );
          }}
          className={cn(
            'relative overflow-hidden rounded-md border border-border',
            'bg-[var(--blue-4,#1e3a5f)]',
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-crosshair',
          )}
          style={{ width: '100%', maxWidth: MAP_WIDTH, aspectRatio: '2 / 1' }}
        >
          {isLoadingLand ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-neutral-11" />
            </div>
          ) : null}
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {landPath ? (
              <path
                d={landPath}
                fill="var(--neutral-6, #444)"
                stroke="var(--neutral-9, #ccc)"
                strokeWidth={0.5}
              />
            ) : null}
            <g className="opacity-25">
              {Array.from({ length: 7 }).map((_, index) => {
                const y = (index / 6) * MAP_HEIGHT;
                return (
                  <line
                    key={`lat-${index}`}
                    x1={0}
                    y1={y}
                    x2={MAP_WIDTH}
                    y2={y}
                    stroke="currentColor"
                    strokeWidth={0.5}
                  />
                );
              })}
              {Array.from({ length: 13 }).map((_, index) => {
                const x = (index / 12) * MAP_WIDTH;
                return (
                  <line
                    key={`lng-${index}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={MAP_HEIGHT}
                    stroke="currentColor"
                    strokeWidth={0.5}
                  />
                );
              })}
            </g>
          </svg>
          {pinPosition ? (
            <span
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-9 ring-2 ring-background"
              style={{
                left: `${(pinPosition.x / MAP_WIDTH) * 100}%`,
                top: `${(pinPosition.y / MAP_HEIGHT) * 100}%`,
              }}
              aria-hidden
            />
          ) : null}
        </div>
        <p className="text-1 text-neutral-11">{t('mapHint')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="space-location-lat">{t('latitudeLabel')}</Label>
          <Input
            id="space-location-lat"
            inputMode="decimal"
            value={latInput}
            onChange={(event) => {
              setLatInput(event.target.value);
              setManualError(null);
            }}
            onBlur={handleManualCoordinates}
            placeholder={t('latitudePlaceholder')}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="space-location-lng">{t('longitudeLabel')}</Label>
          <Input
            id="space-location-lng"
            inputMode="decimal"
            value={lngInput}
            onChange={(event) => {
              setLngInput(event.target.value);
              setManualError(null);
            }}
            onBlur={handleManualCoordinates}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleManualCoordinates();
              }
            }}
            placeholder={t('longitudePlaceholder')}
            disabled={disabled}
          />
        </div>
      </div>
      {manualError ? (
        <p className="text-1 text-error-11" role="alert">
          {manualError}
        </p>
      ) : null}

      {hasPin ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-2 text-foreground">
            {value.locationLabel ??
              t('mapClickLabel', {
                latitude: value.latitude!,
                longitude: value.longitude!,
              })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearLocation}
            disabled={disabled}
          >
            {t('clearLocation')}
          </Button>
        </div>
      ) : null}
    </div>
  );
});
