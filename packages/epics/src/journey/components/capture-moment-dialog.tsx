'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowLeft } from 'lucide-react';
import {
  WELLBEING_DIMENSIONS,
  WELLBEING_PRACTICES,
  feelingFromScore,
  scoreFromAxes,
  type WellbeingDimension,
  type WellbeingScope,
} from '../wellbeing-model';
import { RatingGrid } from './rating-grid';
import '../wellbeing-accents.css';

type CaptureMomentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: WellbeingScope;
  personSlug: string;
  spaceSlug?: string;
  onSave: (input: {
    personSlug: string;
    spaceSlug?: string;
    scope: WellbeingScope;
    dimension: WellbeingDimension;
    practiceId: string;
    felt: number;
    impact: number;
    title: string;
  }) => void;
};

const DIMENSION_DOT: Record<WellbeingDimension, string> = {
  being: 'wb-dot-being',
  thinking: 'wb-dot-thinking',
  relating: 'wb-dot-relating',
  collaborating: 'wb-dot-collaborating',
  acting: 'wb-dot-acting',
};

export function CaptureMomentDialog({
  open,
  onOpenChange,
  scope,
  personSlug,
  spaceSlug,
  onSave,
}: CaptureMomentDialogProps) {
  const t = useTranslations('Wellbeing');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dimension, setDimension] = useState<WellbeingDimension | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [felt, setFelt] = useState(50);
  const [impact, setImpact] = useState(50);
  const [title, setTitle] = useState('');

  const score = scoreFromAxes(felt, impact);
  const feeling = feelingFromScore(score);
  const practices = dimension ? WELLBEING_PRACTICES[dimension] : [];

  const reset = () => {
    setStep(1);
    setDimension(null);
    setPracticeId(null);
    setFelt(50);
    setImpact(50);
    setTitle('');
  };

  const suggestedTitle = useMemo(() => {
    if (!dimension || !practiceId) return '';
    return t(`suggestTitle.${dimension}.${practiceId}`);
  }, [dimension, practiceId, t]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="wb-scope w-[min(28rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
            {t('captureTitle')}
          </DialogTitle>
          <DialogDescription className="text-5 font-semibold text-foreground">
            {step === 1 && t('captureQuestion')}
            {step === 2 &&
              dimension &&
              t('practiceQuestion', { dimension: t(`dimension.${dimension}`) })}
            {step === 3 && t('rateQuestion')}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid gap-2">
            {WELLBEING_DIMENSIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDimension(key);
                  setStep(2);
                }}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-background-2 px-3 py-3 text-left transition-colors hover:border-accent-8 hover:bg-accent-2"
              >
                <span
                  className={cn(
                    'size-9 shrink-0 rounded-full',
                    DIMENSION_DOT[key],
                  )}
                />
                <span>
                  <span className="block text-2 font-semibold text-foreground">
                    {t(`dimension.${key}`)}
                  </span>
                  <span className="block text-1 text-muted-foreground">
                    {t(`dimensionSub.${key}`)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 && dimension ? (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              className="self-start"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t(`dimension.${dimension}`)}
            </Button>
            <div className="grid gap-2">
              {practices.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPracticeId(id);
                    setStep(3);
                  }}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background-2 px-3 py-3 text-left text-2 text-foreground transition-colors hover:border-accent-8 hover:bg-accent-2"
                >
                  {t(`practice.${dimension}.${id}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 && dimension && practiceId ? (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              className="self-start"
              onClick={() => setStep(2)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t(`practice.${dimension}.${practiceId}`)}
            </Button>
            <p className="text-2 text-muted-foreground">{t('rateHint')}</p>
            <RatingGrid
              felt={felt}
              impact={impact}
              onChange={({ felt: nextFelt, impact: nextImpact }) => {
                setFelt(nextFelt);
                setImpact(nextImpact);
              }}
              feltLowLabel={t('axisFeltLow')}
              feltHighLabel={t('axisFeltHigh')}
              impactLowLabel={t('axisImpactLow')}
              impactHighLabel={t('axisImpactHigh')}
              dragHint={t('dragHint')}
              score={score}
              markerClassName={DIMENSION_DOT[dimension]}
            />
            <div className="rounded-xl border border-border/70 bg-background-2 p-3">
              <p className="text-2 font-semibold text-foreground">
                {score} · {t(`feeling.${feeling}`)}
              </p>
              <p className="text-1 italic text-muted-foreground">
                {t(`insight.${feeling}`)}
              </p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t('nameLabel')}
              </span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('namePlaceholder')}
              />
              <button
                type="button"
                className="self-start text-1 text-accent-11 hover:underline"
                onClick={() => setTitle(suggestedTitle)}
              >
                {t('suggest')}
              </button>
            </label>
            <Button
              className="w-full rounded-xl"
              disabled={!title.trim()}
              onClick={() => {
                onSave({
                  personSlug,
                  spaceSlug,
                  scope,
                  dimension,
                  practiceId,
                  felt,
                  impact,
                  title: title.trim(),
                });
                handleOpenChange(false);
              }}
            >
              {t('saveMoment')}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
