'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import QRCode from 'react-qr-code';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  Heading,
  Input,
} from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import {
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Copy,
  Handshake,
  Loader2,
  Mic,
  PlusCircle,
  Square,
  Wallet,
} from 'lucide-react';
import { useAllSpaces } from '@web/hooks/use-all-spaces';
import { Space } from '@hypha-platform/core/client';
import {
  AI_ONBOARDING_SEED_ACK_EVENT,
  ONBOARDING_SETUP_MODE,
  dispatchAiOnboardingSeed,
  saveOnboardingConversationContext,
  useAiPanel,
} from '@hypha-platform/epics';

const getSpacePath = (lang: string, spaceSlug: string) =>
  `/${lang}/dho/${spaceSlug}/agreements`;

const getNetworkPath = (lang: string) => `/${lang}/network`;
const getCreateSpacePath = (lang: string) => `/${lang}/my-spaces/create`;
const onboardingCardClass =
  'group h-full border-border/70 bg-card/100 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md';
const exchangeButtonBaseClass =
  'inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const EXCHANGE_LINKS = [
  { id: 'coinbase', label: 'Coinbase', href: 'https://www.coinbase.com' },
  { id: 'wirex', label: 'Wirex', href: 'https://wirexapp.com' },
  { id: 'kraken', label: 'Kraken', href: 'https://www.kraken.com' },
] as const;

const exchangeBrandStyles = {
  coinbase:
    'border border-transparent bg-[#0052FF] text-white hover:bg-[#0048e0]',
  wirex: 'border border-transparent bg-[#1973F6] text-white hover:bg-[#155fd0]',
  kraken:
    'border border-transparent bg-[#6C3BFF] text-white hover:bg-[#5a30d6]',
} as const;
const evmAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const normalizeEvmAddress = (value: string | null | undefined) =>
  (value ?? '').replace(/\s+/g, '').trim();

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

function joinWithSingleSpace(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trimStart();
  if (!left) return right;
  if (!right) return left;
  if (/\s$/.test(left) || /^\s/.test(right)) return left + right;
  return `${left} ${right}`;
}

type SelectorOption = { value: string; label: string; searchText?: string };

type SelectorCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  options: SelectorOption[];
  query: string;
  onQueryChange: (next: string) => void;
  value: string;
  onChange: (next: string) => void;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
  unavailableText: string;
  t: (key: string) => string;
};

const filterOptionsByQuery = (options: SelectorOption[], query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return options.filter((option) =>
    (option.searchText ?? option.label).toLowerCase().includes(normalized),
  );
};

function SelectorCard({
  icon,
  title,
  description,
  options,
  query,
  onQueryChange,
  value,
  onChange,
  actionLabel,
  onAction,
  disabled,
  unavailableText,
  t,
}: SelectorCardProps) {
  const filteredOptions = filterOptionsByQuery(options, query);

  return (
    <Card className={onboardingCardClass}>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-5">
          <span className="text-accent-11">{icon}</span>
          {title}
        </CardTitle>
        <CardDescription className="text-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('spaceSearchPlaceholder')}
          aria-label={title}
          disabled={disabled}
        />

        {!disabled && !query.trim() ? (
          <p className="text-1 text-muted-foreground">
            {t('searchToSeeSpaces')}
          </p>
        ) : null}

        {!disabled && query.trim() && filteredOptions.length === 0 ? (
          <p className="text-1 text-muted-foreground">{t('noSpacesFound')}</p>
        ) : null}

        {!disabled && filteredOptions.length > 0 ? (
          <div className="max-h-44 space-y-1 overflow-auto rounded-md border border-border/60 p-1">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                }}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-2 text-foreground transition-colors hover:bg-muted"
              >
                <span>{option.label}</span>
                {value === option.value ? (
                  <span className="text-1 text-muted-foreground">
                    {t('selected')}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          className="w-full"
          onClick={onAction}
          disabled={disabled || !value}
        >
          {actionLabel}
        </Button>
        {disabled ? (
          <p className="text-1 text-muted-foreground">{unavailableText}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OnboardingAdventurePage({
  aiChatEnabled = true,
  onboardingHeroEnabled = true,
}: {
  aiChatEnabled?: boolean;
  onboardingHeroEnabled?: boolean;
}) {
  const t = useTranslations('OnboardingAdventure');
  const tHuman = useTranslations('HumanChatPanel');
  const locale = useLocale();
  const router = useRouter();
  const { spaces, isLoading, error: spacesError } = useAllSpaces();
  const { openAiPanel, setAiOverlayVisible } = useAiPanel();
  const [aiPrompt, setAiPrompt] = useState('');
  const aiPromptRef = useRef(aiPrompt);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationPrefixRef = useRef('');
  const dictationSessionFinalizedRef = useRef(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [isStartingAi, setIsStartingAi] = useState(false);
  const [aiStartStatus, setAiStartStatus] = useState<
    'idle' | 'opening' | 'sending' | 'failed'
  >('idle');
  const [aiStartError, setAiStartError] = useState<string | null>(null);
  const aiStartTimeoutRef = useRef<number | null>(null);

  const [joinSpaceSlug, setJoinSpaceSlug] = useState('');
  const [joinQuery, setJoinQuery] = useState('');
  const [depositSpaceSlug, setDepositSpaceSlug] = useState('');
  const [depositQuery, setDepositQuery] = useState('');
  const [depositDetailsSpaceSlug, setDepositDetailsSpaceSlug] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const spaceOptions = useMemo(
    () =>
      spaces.map((space) => ({
        value: space.slug,
        label: space.title,
        searchText: `${space.title} ${space.slug}`,
      })),
    [spaces],
  );

  const depositEligibleSpaces = useMemo(
    () => spaces.filter((space) => Boolean(space.address)),
    [spaces],
  );

  const depositOptions = useMemo(
    () =>
      depositEligibleSpaces.map((space) => ({
        value: space.slug,
        label: space.title,
        searchText: `${space.title} ${space.slug}`,
      })),
    [depositEligibleSpaces],
  );

  const selectedDepositSpace = useMemo(
    () =>
      depositEligibleSpaces.find(
        (space) => space.slug === depositDetailsSpaceSlug,
      ) ?? null,
    [depositDetailsSpaceSlug, depositEligibleSpaces],
  );

  const hasJoinChoices = spaceOptions.length > 0;
  const hasDepositChoices = depositOptions.length > 0;

  useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      if (aiStartTimeoutRef.current !== null) {
        window.clearTimeout(aiStartTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    aiPromptRef.current = aiPrompt;
  }, [aiPrompt]);

  const stopDictation = () => {
    const recognition = speechRecognitionRef.current;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // ignore stop errors from browser implementation differences
        }
      }
      speechRecognitionRef.current = null;
    }
    dictationPrefixRef.current = '';
    setIsDictating(false);
  };

  const toggleDictation = () => {
    setDictationError(null);
    const SR =
      (globalThis as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (
        globalThis as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionCtor;
        }
      ).webkitSpeechRecognition;

    if (!SR) {
      setDictationError(tHuman('dictationNotSupported'));
      return;
    }
    if (isDictating) {
      stopDictation();
      return;
    }

    dictationSessionFinalizedRef.current = false;
    dictationPrefixRef.current = aiPromptRef.current.trimEnd();
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || 'en';
    recognition.onresult = (event) => {
      let committed = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.[0]) continue;
        if (result.isFinal) {
          committed = joinWithSingleSpace(
            committed,
            result[0].transcript.trim(),
          );
        } else {
          interim = joinWithSingleSpace(interim, result[0].transcript);
        }
      }
      const dictated = joinWithSingleSpace(committed, interim.trim());
      const nextPrompt = joinWithSingleSpace(
        dictationPrefixRef.current,
        dictated,
      );
      aiPromptRef.current = nextPrompt;
      setAiPrompt(nextPrompt);
    };
    const finalizeDictation = (showError: boolean) => {
      if (dictationSessionFinalizedRef.current) return;
      dictationSessionFinalizedRef.current = true;
      speechRecognitionRef.current = null;
      dictationPrefixRef.current = '';
      setIsDictating(false);
      if (showError) {
        setDictationError(tHuman('dictationError'));
      }
    };
    recognition.onerror = (event) => {
      finalizeDictation(event.error !== 'aborted');
    };
    recognition.onend = () => {
      finalizeDictation(false);
    };
    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
      setIsDictating(true);
    } catch {
      speechRecognitionRef.current = null;
      setDictationError(tHuman('dictationNotSupported'));
    }
  };

  useEffect(() => {
    return () => {
      const recognition = speechRecognitionRef.current;
      if (!recognition) return;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    };
  }, []);

  const handleCopyAddress = (address: string) => {
    copyToClipboard(address);
    setCopiedAddress(true);
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(
      () => setCopiedAddress(false),
      2000,
    );
  };

  const handleDepositSpaceChange = (next: string) => {
    setDepositSpaceSlug(next);
    setDepositDetailsSpaceSlug('');
    setCopiedAddress(false);
  };

  const handleStartAiOnboarding = () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    stopDictation();
    const context = {
      mode: ONBOARDING_SETUP_MODE,
      source: 'onboarding_hero' as const,
      locale,
      createdAt: new Date().toISOString(),
    };
    saveOnboardingConversationContext(context);
    dispatchAiOnboardingSeed({ prompt, context });
    setIsStartingAi(true);
    setAiStartStatus('opening');
    setAiStartError(null);
    if (aiStartTimeoutRef.current !== null) {
      window.clearTimeout(aiStartTimeoutRef.current);
    }
    aiStartTimeoutRef.current = window.setTimeout(() => {
      setIsStartingAi(false);
      setAiStartStatus('failed');
      setAiStartError(t('aiHero.handoffTimeout'));
    }, 12000);
    openAiPanel();
    setAiOverlayVisible(false);
  };

  useEffect(() => {
    const onSeedAck = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | {
            ok?: boolean;
            stage?: 'received' | 'sending' | 'sent' | 'error';
            reason?: string;
          }
        | undefined;
      if (detail?.stage === 'received') {
        setAiStartStatus('opening');
        setAiStartError(null);
        return;
      }
      if (detail?.stage === 'sending') {
        setAiStartStatus('sending');
        setAiStartError(null);
        return;
      }
      if (aiStartTimeoutRef.current !== null) {
        window.clearTimeout(aiStartTimeoutRef.current);
        aiStartTimeoutRef.current = null;
      }
      if (detail?.ok) {
        setIsStartingAi(false);
        setAiStartStatus('idle');
        setAiStartError(null);
        setAiPrompt('');
        return;
      }
      setIsStartingAi(false);
      setAiStartStatus('failed');
      setAiStartError(
        detail?.reason === 'send_failed'
          ? t('aiHero.sendFailed')
          : t('aiHero.handoffFailed'),
      );
    };
    window.addEventListener(
      AI_ONBOARDING_SEED_ACK_EVENT,
      onSeedAck as EventListener,
    );
    return () => {
      window.removeEventListener(
        AI_ONBOARDING_SEED_ACK_EVENT,
        onSeedAck as EventListener,
      );
    };
  }, []);

  return (
    <Container className="flex flex-col gap-10 py-8 md:py-10">
      <header className="space-y-3 text-center">
        <p className="mx-auto inline-flex items-center rounded-full border border-accent-8/50 bg-accent-3/40 px-3 py-1 text-1 font-medium text-accent-11">
          {t('subtitle')}
        </p>
        <Heading
          size="9"
          color="secondary"
          weight="medium"
          align="center"
          className="mx-auto max-w-4xl"
        >
          <span className="bg-gradient-to-r from-foreground via-accent-11 to-foreground bg-clip-text text-transparent">
            {t('title')}
          </span>
        </Heading>
      </header>

      {onboardingHeroEnabled ? (
        <section className="relative mx-auto w-full max-w-6xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 -top-8 h-48 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.63_0.19_300_/_0.34),transparent_72%)] blur-2xl"
          />
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-background/80 p-4 shadow-[0_18px_80px_-36px_rgba(0,0,0,0.75)] backdrop-blur-sm md:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,oklch(0.72_0.13_278_/_0.18),transparent_42%),radial-gradient(circle_at_85%_18%,oklch(0.75_0.12_330_/_0.15),transparent_35%)]"
            />
            <div className="relative space-y-3 text-center">
              <h2 className="text-7 font-semibold tracking-tight text-foreground md:text-8">
                {t('aiHero.title')}
              </h2>
              <p className="mx-auto max-w-3xl text-2 text-muted-foreground md:text-3">
                {t('aiHero.description')}
              </p>
            </div>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder={t('aiHero.placeholder')}
              aria-label={t('aiHero.ariaLabel')}
              rows={4}
              className="relative mt-5 min-h-[182px] w-full resize-y rounded-[1.5rem] border border-border/65 bg-background/70 px-5 py-4 text-3 text-foreground shadow-inner outline-none transition-colors placeholder:text-muted-foreground focus:border-accent-8/65 md:min-h-[210px]"
            />
            <div className="relative mt-3 flex items-center justify-between gap-3 px-2 pb-1">
              <button
                type="button"
                onClick={toggleDictation}
                disabled={!aiChatEnabled}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground transition-all hover:border-accent-8/50 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={
                  isDictating
                    ? tHuman('composerStopDictation')
                    : tHuman('composerDictateMessage')
                }
                title={
                  isDictating
                    ? tHuman('composerStopDictation')
                    : tHuman('composerDictateMessage')
                }
              >
                {isDictating ? (
                  <Square className="size-4" aria-hidden />
                ) : (
                  <Mic className="size-4" aria-hidden />
                )}
              </button>
              <Button
                type="button"
                onClick={handleStartAiOnboarding}
                disabled={!aiPrompt.trim() || !aiChatEnabled || isStartingAi}
                className="min-h-11 rounded-full bg-accent-9 px-6 text-accent-contrast shadow-[0_6px_24px_-10px_oklch(0.62_0.19_278)] hover:bg-accent-10"
              >
                <span className="inline-flex items-center gap-2">
                  {isStartingAi ? t('aiHero.starting') : t('aiHero.cta')}
                  {isStartingAi ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUp className="size-4" aria-hidden />
                  )}
                </span>
              </Button>
            </div>
          </div>
          {isStartingAi || aiStartStatus === 'failed' ? (
            <div
              className="mt-2 flex items-center justify-center gap-2 text-1"
              role={aiStartStatus === 'failed' ? 'alert' : 'status'}
            >
              {aiStartStatus === 'failed' ? (
                <>
                  <AlertTriangle
                    className="size-3.5 text-warning-10"
                    aria-hidden
                  />
                  <span className="text-warning-11">
                    {aiStartError ?? t('aiHero.handoffFailed')}
                  </span>
                </>
              ) : aiStartStatus === 'sending' ? (
                <>
                  <Loader2
                    className="size-3.5 animate-spin text-accent-11"
                    aria-hidden
                  />
                  <span className="text-muted-foreground">
                    {t('aiHero.sending')}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2
                    className="size-3.5 text-accent-11"
                    aria-hidden
                  />
                  <span className="text-muted-foreground">
                    {t('aiHero.openingAi')}
                  </span>
                </>
              )}
            </div>
          ) : null}
          {dictationError ? (
            <p role="alert" className="text-center text-1 text-destructive">
              {dictationError}
            </p>
          ) : null}
          {!aiChatEnabled ? (
            <p className="text-center text-1 text-muted-foreground">
              {t('aiHero.unavailable')}
            </p>
          ) : null}
          <p className="text-center text-1 text-muted-foreground/90">
            {t('aiHero.helper')}
          </p>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className={onboardingCardClass}>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-5">
              <Compass className="size-5 text-accent-11" aria-hidden />
              {t('explore.title')}
            </CardTitle>
            <CardDescription className="text-2">
              {t('explore.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(getNetworkPath(locale))}
            >
              {t('explore.cta')}
            </Button>
          </CardContent>
        </Card>

        <Card className={onboardingCardClass}>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-5">
              <PlusCircle className="size-5 text-accent-11" aria-hidden />
              {t('create.title')}
            </CardTitle>
            <CardDescription className="text-2">
              {t('create.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(getCreateSpacePath(locale))}
            >
              {t('create.cta')}
            </Button>
          </CardContent>
        </Card>

        <SelectorCard
          icon={<Handshake className="size-5" aria-hidden />}
          title={t('join.title')}
          description={t('join.description')}
          options={spaceOptions}
          query={joinQuery}
          onQueryChange={(next) => {
            setJoinQuery(next);
            setJoinSpaceSlug('');
          }}
          value={joinSpaceSlug}
          onChange={setJoinSpaceSlug}
          actionLabel={t('join.cta')}
          onAction={() => {
            if (!joinSpaceSlug) return;
            router.push(getSpacePath(locale, joinSpaceSlug));
          }}
          disabled={isLoading || !hasJoinChoices}
          unavailableText={
            isLoading
              ? t('loadingSpaces')
              : spacesError?.message
              ? spacesError.message
              : t('join.unavailable')
          }
          t={t}
        />

        <SelectorCard
          icon={<Wallet className="size-5" aria-hidden />}
          title={t('deposit.title')}
          description={t('deposit.description')}
          options={depositOptions}
          query={depositQuery}
          onQueryChange={(next) => {
            setDepositQuery(next);
            setDepositSpaceSlug('');
            setDepositDetailsSpaceSlug('');
            setCopiedAddress(false);
          }}
          value={depositSpaceSlug}
          onChange={handleDepositSpaceChange}
          actionLabel={t('deposit.cta')}
          onAction={() => {
            if (!depositSpaceSlug) return;
            setCopiedAddress(false);
            setDepositDetailsSpaceSlug(depositSpaceSlug);
          }}
          disabled={isLoading || !hasDepositChoices}
          unavailableText={
            isLoading
              ? t('loadingSpaces')
              : spacesError?.message
              ? spacesError.message
              : t('deposit.unavailable')
          }
          t={t}
        />
      </section>

      {selectedDepositSpace?.address ? (
        <DepositDetailsCard
          t={t}
          space={selectedDepositSpace}
          copiedAddress={copiedAddress}
          onCopyAddress={handleCopyAddress}
        />
      ) : null}
    </Container>
  );
}

function DepositDetailsCard({
  t,
  space,
  copiedAddress,
  onCopyAddress,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  space: Space;
  copiedAddress: boolean;
  onCopyAddress: (address: string) => void;
}) {
  const address = normalizeEvmAddress(space.address);
  if (!address) return null;

  return (
    <Card className={onboardingCardClass}>
      <CardHeader>
        <CardTitle className="text-5">{t('depositDetails.title')}</CardTitle>
        <CardDescription>
          {t('depositDetails.description', { spaceName: space.title })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-warning-8/60 bg-warning-3 px-3 py-2 text-warning-11">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-1 font-medium">
              {t('depositDetails.networkWarning')}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 bg-background/30 p-3">
            <p className="text-1 text-muted-foreground">
              {t('depositDetails.addressLabel')}
            </p>
            <p className="break-all font-mono text-2 text-foreground">
              {address}
            </p>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              onClick={() => onCopyAddress(address)}
              className="inline-flex min-h-11 items-center gap-2"
            >
              <Copy className="size-4" aria-hidden />
              {copiedAddress
                ? t('depositDetails.copied')
                : t('depositDetails.copy')}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXCHANGE_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${exchangeButtonBaseClass} ${
                  exchangeBrandStyles[link.id]
                }`}
                aria-label={link.label}
              >
                <ExchangeBrandLogo brand={link.id} />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mx-auto rounded-lg border border-border/70 bg-white p-3">
          {evmAddressPattern.test(address) ? (
            <QRCode
              value={address}
              size={160}
              aria-label={t('depositDetails.qrAriaLabel', {
                spaceName: space.title,
              })}
            />
          ) : (
            <p className="max-w-40 text-1 text-muted-foreground">
              {t('depositDetails.invalidAddress')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ExchangeBrandLogo({
  brand,
}: {
  brand: (typeof EXCHANGE_LINKS)[number]['id'];
}) {
  if (brand === 'coinbase') {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="10" cy="10" r="10" fill="white" />
        <circle cx="10" cy="10" r="6.3" fill="#0052FF" />
        <circle cx="10" cy="10" r="3.8" fill="white" />
      </svg>
    );
  }

  if (brand === 'wirex') {
    return (
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="white" />
        <path
          d="M5 6.25H8.15L10 8.85L11.85 6.25H15L11.6 10L15 13.75H11.85L10 11.15L8.15 13.75H5L8.4 10L5 6.25Z"
          fill="#1973F6"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 4.8C3 3.81 3.81 3 4.8 3H15.2C16.19 3 17 3.81 17 4.8V8.3C17 9.29 16.19 10.1 15.2 10.1H4.8C3.81 10.1 3 9.29 3 8.3V4.8Z"
        fill="white"
      />
      <circle cx="7" cy="14.7" r="1.8" fill="white" />
      <circle cx="13" cy="14.7" r="1.8" fill="white" />
    </svg>
  );
}
