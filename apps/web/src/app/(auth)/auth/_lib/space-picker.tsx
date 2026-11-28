'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Checkbox,
} from '@hypha-platform/ui';
import { MAX_SPACE_GRANTS } from '@hypha-platform/auth-server/client';

export type PickerSpace = {
  id: number;
  title: string;
  slug: string;
  logoUrl: string | null;
};

/**
 * Which spaces an app may use: "All my spaces" (spaces joined later included) or only the spaces
 * ticked. Used by the consent page and the connected-apps page; the caller owns the state.
 * `pickerSpaces` null = the person's spaces could not be loaded; the explicit choice then stays
 * available only when a stored list is being kept (`keptUnlisted`).
 */
export function SpacePicker({
  title,
  name,
  pickerSpaces,
  mode,
  onModeChange,
  chosen,
  onChosenChange,
  keptUnlisted,
}: {
  title: string;
  /** Radio group name: unique per picker on the page. */
  name: string;
  pickerSpaces: PickerSpace[] | null;
  mode: 'all' | 'spaces';
  onModeChange: (mode: 'all' | 'spaces') => void;
  chosen: Set<number>;
  onChosenChange: (chosen: Set<number>) => void;
  keptUnlisted: boolean;
}) {
  const t = useTranslations('AuthServer');
  const [filter, setFilter] = React.useState('');
  const overLimit = (pickerSpaces?.length ?? 0) > MAX_SPACE_GRANTS;
  const canChooseSpaces = Boolean(pickerSpaces) || keptUnlisted;
  const needle = filter.trim().toLowerCase();
  const visibleSpaces = (pickerSpaces ?? []).filter(
    (x) =>
      !needle ||
      x.title.toLowerCase().includes(needle) ||
      x.slug.toLowerCase().includes(needle),
  );
  const toggleSpace = (id: number, on: boolean) => {
    if (on && chosen.size >= MAX_SPACE_GRANTS) return;
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    onChosenChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-2 font-medium">{title}</legend>
      <label className="flex items-start gap-3 border p-3">
        <input
          type="radio"
          name={name}
          className="mt-1"
          checked={mode === 'all'}
          onChange={() => onModeChange('all')}
        />
        <span className="flex flex-col">
          <span className="text-2 font-medium">
            {t('consent.spaces.all.title')}
          </span>
          <span className="text-1 text-neutral-11">
            {t('consent.spaces.all.detail')}
          </span>
        </span>
      </label>
      <label
        className={`flex items-start gap-3 border p-3 ${
          canChooseSpaces ? '' : 'opacity-60'
        }`}
      >
        <input
          type="radio"
          name={name}
          className="mt-1"
          checked={mode === 'spaces'}
          disabled={!canChooseSpaces}
          onChange={() => onModeChange('spaces')}
        />
        <span className="flex flex-col">
          <span className="text-2 font-medium">
            {t('consent.spaces.explicit.title')}
          </span>
          <span className="text-1 text-neutral-11">
            {t('consent.spaces.explicit.detail')}
          </span>
        </span>
      </label>
      {mode === 'spaces' && pickerSpaces ? (
        <div className="flex flex-col gap-2 pl-6">
          {pickerSpaces.length === 0 ? (
            <p className="text-1 text-neutral-11">{t('consent.spaces.none')}</p>
          ) : (
            <>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('consent.spaces.filter')}
                aria-label={t('consent.spaces.filter')}
                className="border p-2 text-2"
              />
              <div className="flex flex-wrap items-center gap-3 text-1">
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    onChosenChange(
                      new Set(
                        pickerSpaces
                          .slice(0, MAX_SPACE_GRANTS)
                          .map((x) => x.id),
                      ),
                    )
                  }
                >
                  {t('consent.spaces.selectAll')}
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => onChosenChange(new Set())}
                >
                  {t('consent.spaces.selectNone')}
                </button>
              </div>
              {overLimit ? (
                <p role="note" className="text-1 text-warning-11">
                  {t('consent.spaces.limit', { max: MAX_SPACE_GRANTS })}
                </p>
              ) : null}
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {visibleSpaces.map((space) => (
                  <li key={space.id} className="flex items-start gap-3">
                    <Checkbox
                      id={`${name}-space-${space.id}`}
                      checked={chosen.has(space.id)}
                      onCheckedChange={(v) => toggleSpace(space.id, v === true)}
                    />
                    <Avatar className="h-6 w-6">
                      {space.logoUrl ? (
                        <AvatarImage src={space.logoUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="text-1">
                        {(space.title || '?').slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor={`${name}-space-${space.id}`}
                      className="text-2"
                    >
                      {space.title}{' '}
                      <span className="text-1 text-neutral-11">
                        {space.slug}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
      {!pickerSpaces ? (
        <p role="note" className="text-1 text-neutral-11">
          {keptUnlisted && mode === 'spaces'
            ? t('consent.spaces.unavailableKept')
            : t('consent.spaces.unavailable')}
        </p>
      ) : null}
      <p className="text-1 text-neutral-11">{t('consent.spaces.note')}</p>
    </fieldset>
  );
}
