'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowLeft } from 'lucide-react';
import {
  CATEGORY_TO_DIMENSION,
  DEFAULT_WELLBEING_MODE,
  NVC_FIELDS,
  STANDARD_CATEGORIES,
  SUGGESTED_TOPICS,
  WELLBEING_DIMENSIONS,
  WELLBEING_MODES,
  WELLBEING_PRACTICES,
  extractTopics,
  feelingFromScore,
  parseTopicsInput,
  preferredModeFor,
  scoreFromAxes,
  type NvcField,
  type StandardCategory,
  type WellbeingDimension,
  type WellbeingMode,
  type WellbeingScope,
  type WellbeingTiming,
} from '../wellbeing-model';
import { useJourneyStore } from '../use-journey-store';
import { RatingGrid } from './rating-grid';
import {
  EmotionHeartIcon,
  IdgDimensionIcon,
  MatrixHandle,
  StandardCategoryIcon,
} from './wellbeing-icons';
import '../wellbeing-accents.css';

export type CaptureMomentInput = {
  personSlug: string;
  spaceSlug?: string;
  scope: WellbeingScope;
  mode: WellbeingMode;
  dimension: WellbeingDimension;
  practiceId: string;
  felt: number;
  impact: number;
  title: string;
  category?: StandardCategory;
  comment?: string;
  experience?: string;
  actionNote?: string;
  emotionNote?: string;
  decisionNote?: string;
  discoveryNote?: string;
  nvc?: Partial<Record<NvcField, string>>;
  topics?: string[];
  timing?: WellbeingTiming;
};

type CaptureMomentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: WellbeingScope;
  personSlug: string;
  spaceSlug?: string;
  mode?: WellbeingMode;
  onModeChange?: (mode: WellbeingMode) => void;
  onSave: (input: CaptureMomentInput) => void;
};

const DIMENSION_DOT: Record<WellbeingDimension, string> = {
  being: 'wb-dot-being',
  thinking: 'wb-dot-thinking',
  relating: 'wb-dot-relating',
  collaborating: 'wb-dot-collaborating',
  acting: 'wb-dot-acting',
};

const CATEGORY_DOT: Record<StandardCategory, string> = {
  experience: 'wb-dot-experience',
  action: 'wb-dot-action',
  emotion: 'wb-dot-emotion',
  decision: 'wb-dot-decision',
  discovery: 'wb-dot-discovery',
};

const emptyNvc = (): Record<NvcField, string> => ({
  reaction: '',
  happened: '',
  feeling: '',
  need: '',
  request: '',
});

export function CaptureMomentDialog({
  open,
  onOpenChange,
  scope,
  personSlug,
  spaceSlug,
  mode: modeProp,
  onModeChange,
  onSave,
}: CaptureMomentDialogProps) {
  const t = useTranslations('Wellbeing');
  const journey = useJourneyStore(personSlug);
  const storedMode = preferredModeFor(journey.state, spaceSlug);
  const [mode, setMode] = useState<WellbeingMode>(
    modeProp ?? storedMode ?? DEFAULT_WELLBEING_MODE,
  );
  const [step, setStep] = useState(0);
  const [dimension, setDimension] = useState<WellbeingDimension | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [category, setCategory] = useState<StandardCategory | null>(null);
  const [comment, setComment] = useState('');
  const [nvc, setNvc] = useState(emptyNvc);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicDraft, setTopicDraft] = useState('');
  const [timing, setTiming] = useState<WellbeingTiming>('now');
  const [felt, setFelt] = useState(50);
  const [impact, setImpact] = useState(50);
  const [title, setTitle] = useState('');

  const score = scoreFromAxes(felt, impact);
  const feeling = feelingFromScore(score);
  const practices = dimension ? WELLBEING_PRACTICES[dimension] : [];

  useEffect(() => {
    if (!open) return;
    setMode(modeProp ?? storedMode ?? DEFAULT_WELLBEING_MODE);
  }, [modeProp, open, storedMode]);

  const reset = () => {
    setStep(0);
    setDimension(null);
    setPracticeId(null);
    setCategory(null);
    setComment('');
    setNvc(emptyNvc());
    setTopics([]);
    setTopicDraft('');
    setTiming('now');
    setFelt(50);
    setImpact(50);
    setTitle('');
  };

  const chooseMode = (next: WellbeingMode) => {
    setMode(next);
    setStep(1);
    setDimension(null);
    setPracticeId(null);
    setCategory(null);
    onModeChange?.(next);
    journey.setPreferredMode(next, spaceSlug);
  };

  const suggestedTitle = useMemo(() => {
    if (mode === 'idg' && dimension && practiceId) {
      return t(`suggestTitle.${dimension}.${practiceId}`);
    }
    if (mode === 'standard' && category) {
      return comment.trim().slice(0, 72) || t(`standardSuggest.${category}`);
    }
    if (mode === 'nvc' && nvc.feeling.trim()) {
      return nvc.feeling.trim().slice(0, 72);
    }
    return '';
  }, [category, comment, dimension, mode, nvc.feeling, practiceId, t]);

  const detectedTopics = useMemo(
    () => extractTopics(comment, ...Object.values(nvc), title),
    [comment, nvc, title],
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const toggleTopic = (topic: string) => {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic],
    );
  };

  const addDraftTopics = () => {
    const next = parseTopicsInput(topicDraft);
    if (next.length === 0) return;
    setTopics((current) => [...new Set([...current, ...next])]);
    setTopicDraft('');
  };

  const resolvedTitle = () =>
    title.trim() || suggestedTitle || comment.trim().slice(0, 72);

  const saveStandard = () => {
    if (!category || !comment.trim()) return;
    const nextTitle = resolvedTitle();
    if (!nextTitle) return;
    onSave({
      personSlug,
      spaceSlug,
      scope,
      mode: 'standard',
      dimension: CATEGORY_TO_DIMENSION[category],
      practiceId: category,
      felt,
      impact,
      title: nextTitle,
      category,
      comment: comment.trim(),
      experience: comment.trim(),
      topics: [...new Set([...topics, ...detectedTopics])],
      timing,
    });
    handleOpenChange(false);
  };

  const saveIdg = () => {
    if (!dimension || !practiceId || !title.trim()) return;
    onSave({
      personSlug,
      spaceSlug,
      scope,
      mode: 'idg',
      dimension,
      practiceId,
      felt,
      impact,
      title: title.trim(),
    });
    handleOpenChange(false);
  };

  const saveNvc = () => {
    const nextTitle = resolvedTitle();
    if (!nextTitle || !nvc.happened.trim() || !nvc.feeling.trim()) return;
    onSave({
      personSlug,
      spaceSlug,
      scope,
      mode: 'nvc',
      dimension: 'relating',
      practiceId: 'nvc',
      felt,
      impact,
      title: nextTitle,
      nvc,
      topics: [...new Set([...topics, ...detectedTopics])],
      timing,
    });
    handleOpenChange(false);
  };

  const description =
    step === 0
      ? t('modeQuestion')
      : mode === 'standard' && step === 1
      ? t('standardQuestion')
      : mode === 'standard' && step === 2
      ? t('rateQuestion')
      : mode === 'standard' && step === 3
      ? t('standardNoteQuestion')
      : mode === 'idg' && step === 1
      ? t('captureQuestion')
      : mode === 'idg' && step === 2 && dimension
      ? t('practiceQuestion', { dimension: t(`dimension.${dimension}`) })
      : mode === 'nvc' && step === 1
      ? t('rateQuestion')
      : mode === 'nvc' && step >= 2 && step <= 6
      ? t(`nvcPrompt.${NVC_FIELDS[step - 2] ?? 'reaction'}`)
      : mode === 'nvc' && step === 7
      ? t('topicsQuestion')
      : t('rateQuestion');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="wb-scope w-[min(32rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
            {t('captureTitle')}
          </DialogTitle>
          <DialogDescription className="text-5 font-semibold text-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {step > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {WELLBEING_MODES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseMode(key)}
                className={cn(
                  'rounded-xl border px-2.5 py-1 text-1 font-medium transition-colors',
                  mode === key
                    ? 'border-accent-8 bg-accent-3 text-accent-12'
                    : 'border-border/70 bg-background-2 text-muted-foreground hover:border-accent-7',
                )}
              >
                {t(`mode.${key}`)}
              </button>
            ))}
          </div>
        ) : null}

        {step === 0 ? (
          <div className="grid gap-2">
            {WELLBEING_MODES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseMode(key)}
                className="flex flex-col gap-1 rounded-xl border border-border/70 bg-background-2 px-3 py-3 text-left transition-colors hover:border-accent-8 hover:bg-accent-2"
              >
                <span className="text-2 font-semibold text-foreground">
                  {t(`mode.${key}`)}
                </span>
                <span className="text-1 text-muted-foreground">
                  {t(`modeLead.${key}`)}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {mode === 'standard' && step === 1 ? (
          <CategorySpine
            onChoose={(key) => {
              setCategory(key);
              setStep(2);
            }}
          />
        ) : null}

        {mode === 'standard' && step === 2 && category ? (
          <FeelingMatrixStep
            felt={felt}
            impact={impact}
            score={score}
            feeling={feeling}
            handle={
              <MatrixHandle className={CATEGORY_DOT[category]}>
                <StandardCategoryIcon category={category} className="size-4" />
              </MatrixHandle>
            }
            onChange={({ felt: nextFelt, impact: nextImpact }) => {
              setFelt(nextFelt);
              setImpact(nextImpact);
            }}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            backLabel={t(`category.${category}`)}
          />
        ) : null}

        {mode === 'standard' && step === 3 ? (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              className="self-start"
              onClick={() => setStep(2)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t('backToFields')}
            </Button>
            <label className="flex flex-col gap-1.5">
              <span className="text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t('standardNoteLabel')}
              </span>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={5}
                className="rounded-xl"
                placeholder={t('standardNotePlaceholder')}
              />
            </label>
            <TopicsBlock
              topics={topics}
              detected={detectedTopics}
              draft={topicDraft}
              timing={timing}
              onDraft={setTopicDraft}
              onAddDraft={addDraftTopics}
              onToggle={toggleTopic}
              onTiming={setTiming}
            />
            <NameField
              title={title}
              suggestedTitle={suggestedTitle}
              onTitle={setTitle}
            />
            <Button
              className="w-full rounded-xl"
              disabled={!comment.trim()}
              onClick={saveStandard}
            >
              {t('saveNote')}
            </Button>
          </div>
        ) : null}

        {mode === 'idg' && step === 1 ? (
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
                    'flex size-10 shrink-0 items-center justify-center rounded-xl text-white',
                    DIMENSION_DOT[key],
                  )}
                >
                  <IdgDimensionIcon dimension={key} className="size-5" />
                </span>
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

        {mode === 'idg' && step === 2 && dimension ? (
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

        {mode === 'idg' && step === 3 && dimension && practiceId ? (
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
              variant="idg"
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
              handle={
                <MatrixHandle className={DIMENSION_DOT[dimension]}>
                  <IdgDimensionIcon dimension={dimension} className="size-4" />
                </MatrixHandle>
              }
            />
            <div className="rounded-xl border border-border/70 bg-background-2 p-3">
              <p className="text-2 font-semibold text-foreground">
                {score} · {t(`feeling.${feeling}`)}
              </p>
              <p className="text-1 italic text-muted-foreground">
                {t(`insight.${feeling}`)}
              </p>
            </div>
            <NameField
              title={title}
              suggestedTitle={suggestedTitle}
              onTitle={setTitle}
            />
            <Button
              className="w-full rounded-xl"
              disabled={!title.trim()}
              onClick={saveIdg}
            >
              {t('saveMoment')}
            </Button>
          </div>
        ) : null}

        {mode === 'nvc' && step === 1 ? (
          <FeelingMatrixStep
            felt={felt}
            impact={impact}
            score={score}
            feeling={feeling}
            handle={
              <MatrixHandle className="wb-dot-emotion">
                <EmotionHeartIcon className="size-4" />
              </MatrixHandle>
            }
            onChange={({ felt: nextFelt, impact: nextImpact }) => {
              setFelt(nextFelt);
              setImpact(nextImpact);
            }}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            backLabel={t('mode.nvc')}
          />
        ) : null}

        {mode === 'nvc' && step >= 2 && step <= 6 ? (
          <NvcStep
            field={NVC_FIELDS[step - 2] ?? 'reaction'}
            value={nvc[NVC_FIELDS[step - 2] ?? 'reaction']}
            onChange={(value) =>
              setNvc((current) => ({
                ...current,
                [NVC_FIELDS[step - 2] ?? 'reaction']: value,
              }))
            }
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(step + 1)}
          />
        ) : null}

        {mode === 'nvc' && step === 7 ? (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              colorVariant="neutral"
              className="self-start"
              onClick={() => setStep(6)}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t('backToFields')}
            </Button>
            <TopicsBlock
              topics={topics}
              detected={detectedTopics}
              draft={topicDraft}
              timing={timing}
              onDraft={setTopicDraft}
              onAddDraft={addDraftTopics}
              onToggle={toggleTopic}
              onTiming={setTiming}
            />
            <NameField
              title={title}
              suggestedTitle={suggestedTitle}
              onTitle={setTitle}
            />
            <Button
              className="w-full rounded-xl"
              disabled={!nvc.happened.trim() || !nvc.feeling.trim()}
              onClick={saveNvc}
            >
              {t('saveNote')}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategorySpine({
  onChoose,
}: {
  onChoose: (category: StandardCategory) => void;
}) {
  const t = useTranslations('Wellbeing');
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {t('feelingAxisImpactHigh')}
      </p>
      <div className="relative py-1">
        <span
          className="absolute top-3 bottom-3 left-1/2 w-px -translate-x-1/2 bg-border"
          aria-hidden
        />
        <div className="grid gap-3">
          {STANDARD_CATEGORIES.map((key, index) => {
            const labelOnRight = index % 2 === 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChoose(key)}
                className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-left"
              >
                <span
                  className={cn(
                    'min-w-0',
                    labelOnRight ? 'col-start-3' : 'col-start-1 text-right',
                  )}
                >
                  <span
                    className={cn(
                      'block text-2 font-semibold',
                      `wb-fill-${key}`,
                    )}
                  >
                    {t(`category.${key}`)}
                  </span>
                  <span className="block text-1 text-muted-foreground">
                    {t(`categoryLead.${key}`)}
                  </span>
                </span>
                <span
                  className={cn(
                    'relative z-10 col-start-2 flex size-11 items-center justify-center rounded-full text-white',
                    CATEGORY_DOT[key],
                  )}
                >
                  <StandardCategoryIcon category={key} className="size-5" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {t('feelingAxisImpactLow')}
      </p>
    </div>
  );
}

function FeelingMatrixStep({
  felt,
  impact,
  score,
  feeling,
  handle,
  onChange,
  onBack,
  onNext,
  backLabel,
}: {
  felt: number;
  impact: number;
  score: number;
  feeling: ReturnType<typeof feelingFromScore>;
  handle: ReactNode;
  onChange: (next: { felt: number; impact: number }) => void;
  onBack: () => void;
  onNext: () => void;
  backLabel: string;
}) {
  const t = useTranslations('Wellbeing');
  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        colorVariant="neutral"
        className="self-start"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Button>
      <RatingGrid
        variant="feeling"
        felt={felt}
        impact={impact}
        onChange={onChange}
        feltLowLabel=""
        feltHighLabel=""
        impactLowLabel={t('feelingAxisImpactLow')}
        impactHighLabel={t('feelingAxisImpactHigh')}
        dragHint={t('dragHint')}
        score={score}
        handle={handle}
      />
      <div className="rounded-xl border border-border/70 bg-background-2 p-3">
        <p className="text-2 font-semibold text-foreground">
          {score} · {t(`feeling.${feeling}`)}
        </p>
        <p className="text-1 italic text-muted-foreground">
          {t(`insight.${feeling}`)}
        </p>
      </div>
      <Button className="w-full rounded-xl" onClick={onNext}>
        {t('continue')}
      </Button>
    </div>
  );
}

function NameField({
  title,
  suggestedTitle,
  onTitle,
}: {
  title: string;
  suggestedTitle: string;
  onTitle: (value: string) => void;
}) {
  const t = useTranslations('Wellbeing');
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {t('nameLabel')}
      </span>
      <Input
        value={title}
        onChange={(event) => onTitle(event.target.value)}
        placeholder={t('namePlaceholder')}
      />
      {suggestedTitle ? (
        <button
          type="button"
          className="self-start text-1 text-accent-11 hover:underline"
          onClick={() => onTitle(suggestedTitle)}
        >
          {t('suggest')}
        </button>
      ) : null}
    </label>
  );
}

function NvcStep({
  field,
  value,
  onChange,
  onBack,
  onNext,
}: {
  field: NvcField;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('Wellbeing');
  const required = field === 'happened' || field === 'feeling';
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="ghost"
        colorVariant="neutral"
        className="self-start"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t(`nvcPrompt.${field}`)}
      </Button>
      <p className="text-2 text-muted-foreground">{t(`nvcHint.${field}`)}</p>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="rounded-xl"
        placeholder={t(`nvcPlaceholder.${field}`)}
      />
      <Button
        className="w-full rounded-xl"
        disabled={required && !value.trim()}
        onClick={onNext}
      >
        {t('continue')}
      </Button>
    </div>
  );
}

function TopicsBlock({
  topics,
  detected,
  draft,
  timing,
  onDraft,
  onAddDraft,
  onToggle,
  onTiming,
}: {
  topics: string[];
  detected: string[];
  draft: string;
  timing: WellbeingTiming;
  onDraft: (value: string) => void;
  onAddDraft: () => void;
  onToggle: (topic: string) => void;
  onTiming: (value: WellbeingTiming) => void;
}) {
  const t = useTranslations('Wellbeing');
  return (
    <div className="flex flex-col gap-4">
      <p className="text-2 text-muted-foreground">{t('topicsSelectLead')}</p>
      {detected.length > 0 ? (
        <ChipGroup
          label={t('topicsFromNote')}
          items={detected}
          selected={topics}
          onToggle={onToggle}
        />
      ) : null}
      <ChipGroup
        label={t('suggestedTopics')}
        items={[...SUGGESTED_TOPICS]}
        selected={topics}
        onToggle={onToggle}
      />
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          placeholder={t('topicsPlaceholder')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onAddDraft();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          onClick={onAddDraft}
        >
          {t('addTopic')}
        </Button>
      </div>
      <div>
        <p className="mb-2 text-1 font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {t('timingLabel')}
        </p>
        <div className="flex gap-2">
          {(['now', 'before'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onTiming(value)}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-2 font-medium uppercase tracking-[0.08em]',
                timing === value
                  ? 'border-accent-8 bg-accent-3 text-accent-12'
                  : 'border-border/70 bg-background-2 text-muted-foreground',
              )}
            >
              {t(`timing.${value}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (topic: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-1 font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => onToggle(topic)}
            className={cn(
              'rounded-xl border px-2.5 py-1 text-1 transition-colors',
              selected.includes(topic)
                ? 'border-accent-8 bg-accent-3 text-accent-12'
                : 'border-border/70 bg-background-2 text-muted-foreground hover:border-accent-7',
            )}
          >
            #{topic}
          </button>
        ))}
      </div>
    </div>
  );
}
