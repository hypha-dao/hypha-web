'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Input,
} from '@hypha-platform/ui';
import { copyToClipboard } from '@hypha-platform/ui-utils';
import {
  ArrowUp,
  AlertTriangle,
  Compass,
  Copy,
  FileIcon,
  Handshake,
  ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  PlusCircle,
  Send,
  Square,
  Video,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useAllSpaces } from '@web/hooks/use-all-spaces';
import { Space, useMe } from '@hypha-platform/core/client';
import {
  ComposerAttachGoogleDriveMenuItem,
  filesToFileList,
  ONBOARDING_SETUP_MODE,
  saveOnboardingConversationContext,
} from '@hypha-platform/epics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { OnboardingAiFullPage } from './onboarding-ai-full-page';

const getSpacePath = (lang: string, spaceSlug: string) =>
  `/${lang}/dho/${spaceSlug}/agreements`;

const getNetworkPath = (lang: string) => `/${lang}/network`;
const getCreateSpacePath = (lang: string) => `/${lang}/my-spaces/create`;
const onboardingCardClass =
  'group h-full rounded-[1.5rem] border border-border/65 bg-background/75 shadow-[0_16px_48px_-34px_rgba(0,0,0,0.65)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-8/35 hover:shadow-[0_20px_56px_-34px_rgba(0,0,0,0.75)]';
const primaryCtaClass =
  'h-10 w-full rounded-lg border border-accent-8/45 bg-gradient-to-r from-accent-9/95 to-accent-10/95 text-accent-contrast shadow-[0_10px_24px_-14px_oklch(0.62_0.19_278)] ring-1 ring-accent-11/12 transition-all hover:brightness-105 hover:ring-accent-11/22';
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
const HERO_TITLE_ROTATING_WORD_KEYS = [
  'anything',
  'projects',
  'startUps',
  'ventures',
  'companies',
  'studios',
  'games',
  'clubs',
  'guilds',
  'associations',
  'schools',
  'cooperatives',
  'collectives',
  'communities',
  'networks',
  'hubs',
  'coalitions',
  'movements',
  'ecosystems',
  'daos',
  'ngos',
  'funds',
  'villages',
  'farms',
  'festivals',
  'solidarity',
  'livelihoods',
] as const;

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
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-5">
          <span className="text-accent-11">{icon}</span>
          {title}
        </CardTitle>
        <CardDescription className="text-2 text-muted-foreground/90">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('spaceSearchPlaceholder')}
          aria-label={title}
          disabled={disabled}
          className="h-10 rounded-xl border-border/70 bg-background/80"
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
          <div className="max-h-44 space-y-1 overflow-auto rounded-xl border border-border/70 bg-background/65 p-1.5">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-2 text-foreground transition-colors hover:bg-muted"
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
          className={primaryCtaClass}
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
  const tCommon = useTranslations('Common');
  const tHuman = useTranslations('HumanChatPanel');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isModalOpen,
    openLoginModal,
  } = useAuthentication();
  const { person } = useMe();
  const { spaces, isLoading, error: spacesError } = useAllSpaces();
  const [aiPrompt, setAiPrompt] = useState('');
  const aiPromptRef = useRef(aiPrompt);
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const heroVideoInputRef = useRef<HTMLInputElement>(null);
  const [heroAttachments, setHeroAttachments] = useState<File[]>([]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationPrefixRef = useRef('');
  const dictationSessionFinalizedRef = useRef(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [isStartingAi, setIsStartingAi] = useState(false);
  const [aiStartError, setAiStartError] = useState<string | null>(null);
  const [onboardingAiConversation, setOnboardingAiConversation] = useState<{
    prompt: string;
    attachments: File[];
    context: {
      mode: typeof ONBOARDING_SETUP_MODE;
      source: 'onboarding_hero';
      firstName?: string;
      locale: string;
      createdAt: string;
    };
  } | null>(null);

  const [joinSpaceSlug, setJoinSpaceSlug] = useState('');
  const [joinQuery, setJoinQuery] = useState('');
  const [depositSpaceSlug, setDepositSpaceSlug] = useState('');
  const [depositQuery, setDepositQuery] = useState('');
  const [depositDetailsSpaceSlug, setDepositDetailsSpaceSlug] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const [heroPlaceholderIndex, setHeroPlaceholderIndex] = useState(0);
  const [heroTitleWordIndex, setHeroTitleWordIndex] = useState(0);
  const seededPromptFromUrlRef = useRef(false);
  const hasPromptedLoginRef = useRef(false);

  const firstName = useMemo(() => {
    const rawName = person?.name?.trim();
    if (!rawName) return undefined;
    const [candidate] = rawName.split(/\s+/);
    return candidate?.trim() || undefined;
  }, [person?.name]);

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
  const rotatingHeroPrompts = useMemo(
    () => [
      t('aiHero.rotating.launchCooperative'),
      t('aiHero.rotating.tokenEconomy'),
      t('aiHero.rotating.createSpace'),
      t('aiHero.rotating.governance'),
      t('aiHero.rotating.joinSpace'),
      t('aiHero.rotating.treasury'),
      t('aiHero.rotating.explore'),
    ],
    [t],
  );
  const rotatingHeroTitleWords = useMemo(
    () =>
      HERO_TITLE_ROTATING_WORD_KEYS.map((key) => t(`heroPill.rotating.${key}`)),
    [t],
  );
  useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (seededPromptFromUrlRef.current) return;
    const promptFromUrl = searchParams.get('prompt')?.trim();
    if (!promptFromUrl) return;
    seededPromptFromUrlRef.current = true;
    aiPromptRef.current = promptFromUrl;
    setAiPrompt(promptFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (isAuthLoading || isAuthenticated || isModalOpen) return;
    if (hasPromptedLoginRef.current) return;
    hasPromptedLoginRef.current = true;
    openLoginModal();
  }, [isAuthLoading, isAuthenticated, isModalOpen, openLoginModal]);

  useEffect(() => {
    aiPromptRef.current = aiPrompt;
  }, [aiPrompt]);

  useEffect(() => {
    if (rotatingHeroPrompts.length < 2) return;
    const intervalId = window.setInterval(() => {
      setHeroPlaceholderIndex((current) =>
        current + 1 >= rotatingHeroPrompts.length ? 0 : current + 1,
      );
    }, 2600);
    return () => window.clearInterval(intervalId);
  }, [rotatingHeroPrompts]);

  useEffect(() => {
    if (rotatingHeroTitleWords.length < 2) return;
    const intervalId = window.setInterval(() => {
      setHeroTitleWordIndex((current) =>
        current + 1 >= rotatingHeroTitleWords.length ? 0 : current + 1,
      );
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [rotatingHeroTitleWords]);

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
    if (!prompt && heroAttachments.length === 0) return;
    stopDictation();
    const context = {
      mode: ONBOARDING_SETUP_MODE,
      source: 'onboarding_hero' as const,
      ...(firstName ? { firstName } : {}),
      locale,
      createdAt: new Date().toISOString(),
    };
    saveOnboardingConversationContext(context);
    setIsStartingAi(true);
    setAiStartError(null);
    setOnboardingAiConversation({
      prompt,
      attachments: heroAttachments,
      context,
    });
    setAiPrompt('');
    setHeroAttachments([]);
    setIsStartingAi(false);
  };

  const pushHeroAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setHeroAttachments((prev) => [...prev, ...Array.from(files)]);
  };
  if (onboardingAiConversation) {
    return (
      <OnboardingAiFullPage
        seedPrompt={onboardingAiConversation.prompt}
        seedAttachments={onboardingAiConversation.attachments}
        context={onboardingAiConversation.context}
        onExit={() => setOnboardingAiConversation(null)}
      />
    );
  }
  return (
    <div className="flex flex-col">
      <section className="relative -mx-5 overflow-hidden px-5 pb-14 pt-8 md:pb-20 md:pt-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent-2/50 via-background to-background [.dark_&]:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle,oklch(0.55_0.12_278_/_0.1)_1px,transparent_1px)] [background-size:36px_36px] [.dark_&]:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_85%_65%_at_50%_22%,oklch(0.24_0.08_280),oklch(0.08_0.03_265)_72%)] [.dark_&]:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_55%_40%_at_50%_58%,oklch(0.2_0.07_292_/_0.55),transparent_68%)] [.dark_&]:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden opacity-40 [background-image:radial-gradient(circle,oklch(1_0_0_/_0.42)_0.5px,transparent_0.5px)] [background-size:32px_32px] [.dark_&]:block"
        />
        <Container className="relative z-10 flex flex-col gap-12 md:gap-14">
          <header className="flex flex-col items-center gap-6 text-center md:gap-8">
            <p className="inline-block rounded-full border border-info-7/40 bg-white/85 px-5 py-1.5 text-2 font-medium text-foreground shadow-[0_4px_28px_-10px_var(--color-info-8)] backdrop-blur-sm [.dark_&]:border-info-8/30 [.dark_&]:bg-black/35 [.dark_&]:text-white [.dark_&]:shadow-[0_0_32px_-10px_var(--color-info-9)]">
              {t('heroPill.build')}{' '}
              <span
                key={rotatingHeroTitleWords[heroTitleWordIndex]}
                className="font-semibold text-info-10 transition-opacity duration-300"
              >
                {rotatingHeroTitleWords[heroTitleWordIndex]}
              </span>
              {t('heroPill.together')}
            </p>
            <p className="text-2 font-semibold uppercase tracking-[0.24em] text-accent-11 md:text-3 [.dark_&]:text-info-11">
              {t('heroEyebrow')}
            </p>
            <h1 className="mx-auto max-w-4xl font-[family-name:var(--font-heading)] text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[1.06] tracking-tight">
              <span className="block text-foreground [.dark_&]:text-white">
                {t('titleLine1')}
              </span>
              <span className="mt-1 block bg-gradient-to-r from-foreground via-accent-10 to-info-10 bg-clip-text text-transparent [.dark_&]:from-white [.dark_&]:via-info-9 [.dark_&]:to-accent-10">
                {t('titleLine2')}
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-4 font-normal leading-relaxed text-foreground/75 md:text-5 [.dark_&]:text-white/90">
              {t('subtitle')}
            </p>
          </header>

          {onboardingHeroEnabled ? (
            <section className="relative mx-auto w-full max-w-5xl">
              <div className="relative overflow-hidden rounded-[1.5rem] border border-border/55 bg-neutral-2 shadow-[0_10px_40px_-24px_oklch(0.45_0.08_278)] [.dark_&]:border-white/10 [.dark_&]:bg-white/[0.04] [.dark_&]:shadow-[0_18px_56px_-30px_oklch(0.35_0.14_278)] [.dark_&]:backdrop-blur-md">
                {heroAttachments.length > 0 ? (
                  <div className="narrow-scrollbar max-h-24 overflow-x-auto overflow-y-hidden border-b border-border/65 px-3 py-2">
                    <div className="flex w-max gap-2">
                      {heroAttachments.map((file, index) => (
                        <div
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-1 text-foreground"
                        >
                          {file.type.startsWith('image/') ? (
                            <ImageIcon className="size-3.5 text-muted-foreground" />
                          ) : file.type.startsWith('video/') ? (
                            <Video className="size-3.5 text-muted-foreground" />
                          ) : (
                            <FileIcon className="size-3.5 text-muted-foreground" />
                          )}
                          <span className="max-w-44 truncate">{file.name}</span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={tHuman('attachmentRemove')}
                            onClick={() =>
                              setHeroAttachments((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder={
                    rotatingHeroPrompts[heroPlaceholderIndex] ??
                    t('aiHero.placeholder')
                  }
                  aria-label={t('aiHero.ariaLabel')}
                  rows={3}
                  className="relative min-h-[120px] w-full resize-none overflow-y-auto bg-transparent px-4 py-3 text-3 text-foreground outline-none placeholder:text-muted-foreground"
                />
                <input
                  ref={heroFileInputRef}
                  type="file"
                  className="sr-only"
                  multiple
                  onChange={(e) => {
                    pushHeroAttachments(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={heroImageInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    pushHeroAttachments(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={heroVideoInputRef}
                  type="file"
                  className="sr-only"
                  accept="video/*"
                  multiple
                  onChange={(e) => {
                    pushHeroAttachments(e.target.files);
                    e.target.value = '';
                  }}
                />
                <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
                  <div className="flex items-center gap-1">
                    <DropdownMenu
                      modal={false}
                      open={attachMenuOpen}
                      onOpenChange={setAttachMenuOpen}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                          aria-label={tHuman('composerAttachMenu')}
                          title={tHuman('composerAttachMenu')}
                        >
                          <Plus className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="min-w-[200px]"
                      >
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onSelect={() =>
                            requestAnimationFrame(() =>
                              heroImageInputRef.current?.click(),
                            )
                          }
                        >
                          <ImageIcon className="size-4" aria-hidden />
                          <span>{tHuman('composerAttachImage')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onSelect={() =>
                            requestAnimationFrame(() =>
                              heroVideoInputRef.current?.click(),
                            )
                          }
                        >
                          <Video className="size-4" aria-hidden />
                          <span>{tHuman('composerAttachVideo')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onSelect={() =>
                            requestAnimationFrame(() =>
                              heroFileInputRef.current?.click(),
                            )
                          }
                        >
                          <Paperclip className="size-4" aria-hidden />
                          <span>{tHuman('composerAttachFile')}</span>
                        </DropdownMenuItem>
                        <ComposerAttachGoogleDriveMenuItem
                          disabled={!aiChatEnabled}
                          onPickerOpen={() => setAttachMenuOpen(false)}
                          onFilesPicked={(files) => {
                            pushHeroAttachments(filesToFileList(files));
                          }}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      type="button"
                      onClick={toggleDictation}
                      disabled={!aiChatEnabled}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <Square className="size-3.5" aria-hidden />
                      ) : (
                        <Mic className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    onClick={handleStartAiOnboarding}
                    disabled={
                      (!aiPrompt.trim() && heroAttachments.length === 0) ||
                      !aiChatEnabled ||
                      isStartingAi
                    }
                    className="h-10 w-10 rounded-full border-0 bg-accent-9 p-0 text-white shadow-[0_8px_20px_-8px_var(--color-accent-9)] transition-all hover:bg-accent-10 hover:brightness-105 [.dark_&]:bg-info-9 [.dark_&]:shadow-[0_8px_20px_-8px_var(--color-info-9)] [.dark_&]:hover:bg-info-10"
                    aria-label={
                      isStartingAi ? t('aiHero.starting') : t('aiHero.cta')
                    }
                  >
                    {isStartingAi ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>
              {aiStartError ? (
                <div
                  className="mt-2 flex items-center justify-center gap-2 text-1"
                  role="alert"
                >
                  <AlertTriangle
                    className="size-3.5 text-warning-10"
                    aria-hidden
                  />
                  <span className="text-warning-11">{aiStartError}</span>
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
            </section>
          ) : null}
        </Container>
      </section>

      <Container className="flex flex-col gap-14 py-10 md:py-12">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className={onboardingCardClass}>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-5">
                <Compass className="size-5 text-accent-11" aria-hidden />
                {t('explore.title')}
              </CardTitle>
              <CardDescription className="text-2 text-muted-foreground/90">
                {t('explore.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <Button
                type="button"
                className={primaryCtaClass}
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
              <CardDescription className="text-2 text-muted-foreground/90">
                {t('create.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <Button
                type="button"
                className={primaryCtaClass}
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
    </div>
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
