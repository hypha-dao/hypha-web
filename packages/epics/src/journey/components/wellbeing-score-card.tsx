'use client';

import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Sparkles } from 'lucide-react';
import {
  WELLBEING_TOKEN_PRICE,
  feelingFromScore,
  trendFromScores,
} from '../wellbeing-model';
import { WellbeingGauge } from './wellbeing-gauge';
import '../wellbeing-accents.css';

type WellbeingScoreCardProps = {
  variant: 'personal' | 'collective';
  score: number | null;
  previousScore?: number | null;
  comparisonScore?: number | null;
  activated: boolean;
  onCapture: () => void;
  onActivate: () => void;
  className?: string;
};

export function WellbeingScoreCard({
  variant,
  score,
  previousScore = null,
  comparisonScore = null,
  activated,
  onCapture,
  onActivate,
  className,
}: WellbeingScoreCardProps) {
  const t = useTranslations('Wellbeing');
  const displayScore = score ?? 50;
  const feeling = feelingFromScore(displayScore);
  const trend = trendFromScores(displayScore, previousScore);

  return (
    <Card className={cn('wb-scope craft-card overflow-hidden', className)}>
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
              {variant === 'personal'
                ? t('personalKicker')
                : t('collectiveKicker')}
            </p>
            <h2 className="mt-1 [font-family:var(--font-family-heading)] text-6 font-semibold tracking-[-0.02em] text-foreground">
              {activated ? t(`feeling.${feeling}`) : t('lockedTitle')}
            </h2>
          </div>
          {activated && trend.direction !== 'steady' ? (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-1 text-1 font-medium',
                trend.direction === 'up'
                  ? 'bg-success-3 text-success-11'
                  : 'bg-error-3 text-error-11',
              )}
            >
              {trend.direction === 'up'
                ? t('trendUp', { delta: Math.abs(trend.delta) })
                : t('trendDown', { delta: Math.abs(trend.delta) })}
            </span>
          ) : null}
        </div>

        <div className="mx-auto flex w-full max-w-[20rem] flex-col items-center">
          <WellbeingGauge
            score={activated ? displayScore : null}
            comparisonScore={activated ? comparisonScore : null}
            activated={activated}
            innerLabel={
              variant === 'personal' ? t('personalScore') : t('collectiveScore')
            }
            outerLabel={t('fieldArcLabel')}
            sadLabel={t('axisFeltLow')}
            happyLabel={t('axisFeltHigh')}
          />
          <p className="text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {variant === 'personal' ? t('personalScore') : t('collectiveScore')}
          </p>
          <p className="text-1 text-muted-foreground">{t('outOf')}</p>
        </div>

        {activated ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2 text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent-9" />
                {t('youLabel', { score: displayScore })}
              </span>
              {comparisonScore != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full border border-neutral-8" />
                  {variant === 'personal'
                    ? t('leadersLabel', { score: comparisonScore })
                    : t('fieldLabel', { score: comparisonScore })}
                </span>
              ) : null}
            </div>
            <p className="text-2 leading-relaxed text-muted-foreground">
              {t('fractalLead')}
            </p>
            <p className="text-2 leading-relaxed text-muted-foreground">
              {t(`insight.${feeling}`)}
            </p>
            <Button onClick={onCapture} className="w-full rounded-xl">
              <Sparkles className="size-4" aria-hidden />
              {variant === 'personal' ? t('captureCta') : t('rateCta')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-2 leading-relaxed text-muted-foreground">
              {t('lockedLead')}
            </p>
            <p className="text-1 text-muted-foreground">{t('tokenNote')}</p>
            <Button onClick={onActivate} className="w-full rounded-xl">
              {t('unlockCta', { price: WELLBEING_TOKEN_PRICE })}
            </Button>
          </div>
        )}

        <p className="flex items-center justify-center gap-2 text-1 uppercase tracking-[0.22em] text-muted-foreground">
          <span>{t('poweredBy')}</span>
          <img
            src="/wellbeing/realifex-wordmark.png"
            alt="REALIFEX"
            className="h-3 w-auto invert dark:invert-0"
          />
        </p>
      </CardContent>
    </Card>
  );
}
