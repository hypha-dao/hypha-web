'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { Droplets, HeartPulse, Landmark, Zap } from 'lucide-react';
import {
  JOURNEY_ADDONS,
  WELLBEING_TOKEN_PRICE,
  type JourneyAddonId,
  type JourneyAddonState,
} from '../wellbeing-model';
import { getDhoPathEnergy } from '../../common/get-path-function';

type SpaceAddonsStripProps = {
  lang: Locale;
  spaceSlug: string;
  energyEnabled: boolean;
  addons: JourneyAddonState;
  onActivateWellbeing: () => void;
};

const ICONS: Record<JourneyAddonId, typeof HeartPulse> = {
  wellbeing: HeartPulse,
  energy: Zap,
  water: Droplets,
  culture: Landmark,
};

export function SpaceAddonsStrip({
  lang,
  spaceSlug,
  energyEnabled,
  addons,
  onActivateWellbeing,
}: SpaceAddonsStripProps) {
  const t = useTranslations('Journey');

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="[font-family:var(--font-family-heading)] text-4 font-semibold tracking-[-0.015em]">
          {t('addonsTitle')}
        </h3>
        <p className="mt-1 text-2 text-muted-foreground">{t('addonsLead')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {JOURNEY_ADDONS.map((addon) => {
          const Icon = ICONS[addon.id];
          const active =
            addon.id === 'wellbeing'
              ? addons.wellbeing
              : addon.id === 'energy'
              ? energyEnabled
              : addon.id === 'water'
              ? addons.water
              : addons.culture;

          return (
            <Card key={addon.id} className="craft-card">
              <CardContent className="flex items-start gap-3 p-4">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-3 text-accent-11">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-2 font-semibold text-foreground">
                    {t(`addon.${addon.id}`)}
                  </p>
                  <p className="mt-0.5 text-1 text-muted-foreground">
                    {t(`addonHint.${addon.id}`)}
                  </p>
                  <div className="mt-3">
                    {!addon.available ? (
                      <span className="text-1 text-muted-foreground">
                        {t('comingSoon')}
                      </span>
                    ) : active ? (
                      addon.id === 'energy' ? (
                        <Button
                          asChild
                          variant="outline"
                          colorVariant="neutral"
                        >
                          <Link href={getDhoPathEnergy(lang, spaceSlug)}>
                            {t('openAddon')}
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-1 font-medium text-success-11">
                          {t('activated')}
                        </span>
                      )
                    ) : addon.id === 'wellbeing' ? (
                      <Button onClick={onActivateWellbeing}>
                        {t('activateWithTokens', {
                          price: WELLBEING_TOKEN_PRICE,
                        })}
                      </Button>
                    ) : addon.id === 'energy' ? (
                      <Button asChild variant="outline" colorVariant="neutral">
                        <Link
                          href={`/${lang}/dho/${spaceSlug}/agreements/select-settings-action`}
                        >
                          {t('enableEnergy')}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
