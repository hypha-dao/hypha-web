'use client';

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ElementType,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import {
  HandCoins,
  Coins,
  FileCheck2,
  House,
  Navigation,
  Menu,
  PanelLeftClose,
  Radio,
  Settings,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import {
  Category,
  Space,
  SpaceFlags,
  useCreateSpaceOrchestrator,
  useCreateAgreementOrchestrator,
  useJwt,
  useMatrix,
  useSpaceBySlug,
  useSpacesBySlugs,
} from '@hypha-platform/core/client';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Button,
} from '@hypha-platform/ui';

import {
  AiPanelHeader,
  AiPanelMessages,
  AiPanelSuggestions,
  AiPanelChatBar,
  OnboardingDiscoveryModeToggle,
  OnboardingVoiceInterviewBar,
  type AiPanelDraftAttachment,
} from './ai-panel';
import { getDhoSpaceContextPath } from './get-dho-space-context-path';
import { getDhoSpaceSlugFromPathname } from './get-dho-space-slug-from-pathname';
import { useAiPanel, useHumanChatPanel } from './human-chat-panel-context';
import { useCompactHeaderMode } from '@hypha-platform/ui';
import { useConfig } from 'wagmi';
import { convertFilesToParts } from './ai-panel/convert-files-to-parts';
import { resolveSpaceDisplayLogoUrl } from '../spaces/utils/resolve-space-display-logo-url';
import {
  UserSpaceState,
  useUserSpaceState,
} from '../spaces/hooks/use-user-space-state';
import { useSpaceDiscoverability } from '../spaces/hooks/use-space-discoverability';
import {
  checkAccess,
  canInteractInSpace,
} from '../spaces/utils/transparency-access';
import { SpaceAccessDenied } from '../spaces/components/space-access-denied';
import { AiPanelSubscriptionBanner } from '../spaces/components/ai-panel-subscription-banner';
import { useSalesBanner } from '../spaces/hooks/use-sales-banner';
import {
  MAX_RECENT_SPACE_HISTORY,
  MAX_VISIBLE_RECENT_SPACES,
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
  syncRecentSpacesForActiveSlug,
} from './recent-space-history';
import { recordMobilizedAiAgentsForQuestion } from './ai-agent-competencies';
import {
  AI_ONBOARDING_SEED_EVENT,
  ONBOARDING_SETUP_MODE,
  applyOnboardingContextForUserText,
  dispatchAiOnboardingSeedAck,
  ensureSpaceSetupContext,
  isSpaceSetupContext,
  readOnboardingConversationContext,
  resolveChatTransportBody,
  resolveSetupContextForUserMessage,
  saveOnboardingConversationContext,
  clearOnboardingConversationContext,
  consumeOnboardingOpenAiPanelPending,
  consumeOnboardingContinuationPrompt,
  readOnboardingChatMessages,
  saveOnboardingChatMessages,
  getPostOnboardingLandingPath,
  getPostOnboardingContinuationPrompt,
  type OnboardingConversationContext,
} from './ai-onboarding-context';
import {
  onboardingLocationFromCreatePayload,
  onboardingTransparencyFromCreatePayload,
  onboardingJoinMethodFromCreatePayload,
} from './onboarding-create-payload';
import {
  extractOnboardingVisualAssetsFromMessages,
  mergeVisualAssetsIntoCreatePayload,
} from './onboarding-visual-assets';
import {
  applyOnboardingLocationToContext,
  formatOnboardingLocationSubmitMessage,
  onboardingSpaceLocationFromPicker,
  skippedOnboardingSpaceLocation,
} from './onboarding-location-ui';
import {
  applyOnboardingActivationToContext,
  formatOnboardingActivationSubmitMessage,
  type OnboardingActivationMethod,
} from './onboarding-activation-ui';
import {
  applyOnboardingSetupJourneyToContext,
  formatOnboardingSetupJourneySubmitMessage,
  type OnboardingSetupJourney,
} from './onboarding-setup-journey-ui';
import {
  applyOnboardingTransparencyToContext,
  formatOnboardingTransparencySubmitMessage,
  type OnboardingTransparencyMessageLabels,
} from './onboarding-transparency-ui';
import {
  applyOnboardingEntryMethodToContext,
  formatOnboardingEntryMethodSubmitMessage,
  type OnboardingEntryMethod,
} from './onboarding-entry-method-ui';
import {
  applyOnboardingVotingMethodToContext,
  formatOnboardingVotingMethodSubmitMessage,
  type OnboardingVotingMethod,
} from './onboarding-voting-method-ui';
import type { OnboardingTransparencyMatrix } from './ai-onboarding-context';
import type { OnboardingDiscoveryMode } from './onboarding-discovery-mode';
import { useOnboardingVoiceDiscovery } from './use-onboarding-voice-discovery';
import {
  appendVoiceTranscriptTurn,
  buildRecentTranscriptSummaryFromChatMessages,
  toStoredOnboardingChatMessages,
} from './onboarding-voice-transcript-bridge';
import type { SpaceLocationValue } from '../spaces/components/space-location-picker';

function extractAssistantTextFromMessage(
  message: ChatUIMessage | undefined,
): string {
  if (!message || message.role !== 'assistant') return '';
  const parts = message.parts ?? [];
  return parts
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map((part) => part.text)
    .join('\n')
    .trim();
}

type ChatUIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  toolInvocations?: Array<Record<string, unknown>>;
};

type MemoryIconProps = {
  className?: string;
};

function MemoryIcon({ className }: MemoryIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.5 3.25v9.5" />
      <path d="M6.5 3.25v9.5" />
      <path d="M9.5 3.25v9.5" />
      <path d="M12.25 3.25l2.75 9.5" />
    </svg>
  );
}

const DEBUG = process.env.NEXT_PUBLIC_CHAT_DEBUG === 'true';
const MENU_BUTTON_CLASS =
  'h-10 w-full rounded-lg border border-transparent p-0 text-sm font-medium text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/80 hover:text-foreground data-[active=true]:border-accent-9/40 data-[active=true]:bg-accent-9/18 data-[active=true]:text-foreground group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!rounded-lg group-data-[collapsible=icon]:!p-0';
const ICON_COLUMN_CLASS = 'flex h-10 w-10 shrink-0 items-center justify-center';
const MENU_ROW_LINK_BASE_CLASS = 'flex h-full w-full min-w-0 items-center';
const MENU_ROW_LINK_EXPANDED_CLASS = 'pl-1.5';
const MENU_ROW_LINK_COLLAPSED_CLASS = 'justify-center';
const MENU_TRIGGER_CANVAS_CLASS =
  'relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-muted p-0 ring-1 ring-border/70';
const MENU_CLOSE_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
const RECENT_SPACE_AVATAR_CLASS =
  'flex h-6 w-6 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60';

type AiLeftPanelProps = {
  enableSpaceMemory?: boolean;
};

type NavItem = {
  key: string;
  label: string;
  icon: ElementType;
  href: string;
  active: boolean;
  disabled?: boolean;
};

export function AiLeftPanel({ enableSpaceMemory = false }: AiLeftPanelProps) {
  const { isAuthenticated, isLoading, getAccessToken } = useAuthentication();
  const matrix = useMatrix();
  const params = useParams<{ id?: string; lang?: string }>();
  const pathname = usePathname();
  const isOnboardingPath = pathname.includes('/onboarding');
  const [onboardingContext, setOnboardingContext] = useState<
    OnboardingConversationContext | undefined
  >(() => readOnboardingConversationContext());
  const spaceSlugFromPath = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  /** Prefer pathname: AiLeftPanel mounts in root layout where `id` is often missing for `/dho/[id]/...` routes. */
  const spaceSlug = spaceSlugFromPath ?? params?.id;
  const t = useTranslations('AiPanel');
  const tCommon = useTranslations('Common');
  const tModalAside = useTranslations('ModalAside');
  const tCoherence = useTranslations('CoherenceTab');
  const tSelectNavigation = useTranslations('SelectNavigationAction');
  const tTreasury = useTranslations('TreasuryTab');
  const tSpaces = useTranslations('Spaces');
  const router = useRouter();
  const config = useConfig();
  const { resolvedTheme } = useTheme();
  const { jwt } = useJwt();
  const lang = typeof params?.lang === 'string' ? params.lang : 'en';
  const isCompactHeader = useCompactHeaderMode();
  const { space } = useSpaceBySlug(spaceSlug ?? '');
  const effectiveSpaceWeb3Id = space?.web3SpaceId ?? undefined;
  const { access: spaceActivityAccess, isLoading: isDiscoverabilityLoading } =
    useSpaceDiscoverability({
      spaceId: effectiveSpaceWeb3Id ? BigInt(effectiveSpaceWeb3Id) : undefined,
    });
  const { userState: userSpaceState, isLoading: isUserSpaceStateLoading } =
    useUserSpaceState({
      spaceSlug,
      space,
      spaceId: effectiveSpaceWeb3Id,
    });
  const hasSpaceActivityAccess = checkAccess(
    spaceActivityAccess,
    userSpaceState,
  );
  const blockSpaceAiForActivityAccess =
    Boolean(spaceSlug) &&
    !isUserSpaceStateLoading &&
    !isDiscoverabilityLoading &&
    !hasSpaceActivityAccess;
  const blockSpaceAiForMembership =
    Boolean(spaceSlug) &&
    !isOnboardingPath &&
    !isSpaceSetupContext(onboardingContext) &&
    !isUserSpaceStateLoading &&
    !canInteractInSpace(userSpaceState);
  const { status: spacePaymentStatus, isLoading: isSpacePaymentStatusLoading } =
    useSalesBanner({
      spaceId: effectiveSpaceWeb3Id,
    });
  const blockSpaceAiForSubscription =
    Boolean(spaceSlug) &&
    Boolean(effectiveSpaceWeb3Id) &&
    !isSpaceSetupContext(onboardingContext) &&
    !isSpacePaymentStatusLoading &&
    spacePaymentStatus === 'expired';
  const blockSpaceAiForInteraction =
    blockSpaceAiForMembership || blockSpaceAiForSubscription;
  const {
    open: isAiOpen,
    overlayVisible,
    openAiPanel,
    closeAiPanel,
    setAiOverlayVisible,
    showAiOverlay,
    hideAiOverlay,
  } = useAiPanel();
  const { open: rightOpen, toggle: toggleRight } = useHumanChatPanel();
  const { spaces: activeSpaces } = useSpacesBySlugs(
    spaceSlug ? [spaceSlug] : [],
    false,
  );
  const activeSpaceName =
    activeSpaces?.[0]?.title?.trim() || spaceSlug?.trim() || undefined;
  const activeSpaceChatRoomId = activeSpaces?.[0]?.chatRoomId?.trim() || null;
  const [input, setInput] = useState('');
  const aiWalletCreateInFlightRef = useRef(false);
  const handledWalletPayloadKeyRef = useRef<string | null>(null);
  const aiWalletProposalInFlightRef = useRef(false);
  const handledWalletProposalPayloadKeyRef = useRef<string | null>(null);
  const [draftAttachments, setDraftAttachments] = useState<
    AiPanelDraftAttachment[]
  >([]);
  const draftAttachmentsRef = useRef<AiPanelDraftAttachment[]>([]);
  draftAttachmentsRef.current = draftAttachments;
  const autoRetryingRef = useRef(false);
  const lastAutoRetriedMessageIdRef = useRef<string | null>(null);
  const [recentSpaceSlugs, setRecentSpaceSlugs] = useState<string[]>(() =>
    readRecentSpaceSlugs(),
  );
  const pendingSeedPromptRef = useRef<string | null>(null);
  const pendingSeedAttachmentsRef = useRef<File[]>([]);
  const lastAutoTransitionSpaceSlugRef = useRef<string | null>(null);
  const lastAutoNavigationKeyRef = useRef<string | null>(null);
  const lastMcpNavigationTargetSpaceSlugRef = useRef<string | null>(null);
  const lastChatSpaceSlugRef = useRef<string | null>(spaceSlug?.trim() || null);
  const skipNextChatResetRef = useRef(false);
  const onboardingHandoffHydratedRef = useRef(false);
  const {
    createSpace: createSpaceWithWalletFlow,
    space: walletCreatedSpace,
    isError: isCreateSpaceWithWalletFlowError,
    errors: createSpaceWithWalletFlowErrors,
  } = useCreateSpaceOrchestrator({ authToken: jwt, config });
  const {
    createAgreement: createAgreementWithWalletFlow,
    isError: isCreateAgreementWithWalletFlowError,
    errors: createAgreementWithWalletFlowErrors,
  } = useCreateAgreementOrchestrator({ authToken: jwt, config });

  useEffect(() => {
    if (createAgreementWithWalletFlowErrors.length === 0) return;
    console.error(
      '[AiLeftPanel] wallet agreement flow errors:',
      createAgreementWithWalletFlowErrors,
    );
  }, [createAgreementWithWalletFlowErrors]);

  const recentSpaceLookupSlugs = useMemo(
    () =>
      recentSpaceSlugs
        .filter((slug): slug is string => typeof slug === 'string' && !!slug)
        .slice(0, MAX_RECENT_SPACE_HISTORY),
    [recentSpaceSlugs],
  );
  const { spaces: recentSpacesData, error: recentSpacesError } =
    useSpacesBySlugs(recentSpaceLookupSlugs, false);
  const isSectionActive = useCallback(
    (
      section:
        | 'overview'
        | 'coherence'
        | 'ecosystem-navigation'
        | 'agreements'
        | 'members'
        | 'treasury'
        | 'rewards'
        | 'memory'
        | 'wallet',
    ) => {
      if (!spaceSlug) return false;
      if (
        section === 'agreements' &&
        pathname.includes(`/dho/${spaceSlug}/`) &&
        (pathname.includes('/space-configuration') ||
          pathname.includes('/select-settings-action'))
      ) {
        return false;
      }
      const base = `/${lang}/dho/${spaceSlug}/${section}`;
      return pathname === base || pathname.startsWith(`${base}/`);
    },
    [lang, pathname, spaceSlug],
  );

  const sectionNavItems = useMemo<NavItem[]>(() => {
    if (!spaceSlug) return [];
    return [
      {
        key: 'overview',
        label: tCommon('home'),
        icon: House,
        href: `/${lang}/dho/${spaceSlug}/overview`,
        active: isSectionActive('overview'),
      },
      {
        key: 'ecosystem-navigation',
        label: tSelectNavigation('ecosystem'),
        icon: Navigation,
        href: `/${lang}/dho/${spaceSlug}/ecosystem-navigation`,
        active: isSectionActive('ecosystem-navigation'),
      },
      {
        key: 'signals',
        label: tCoherence('signals'),
        icon: Radio,
        href: `/${lang}/dho/${spaceSlug}/coherence`,
        active: isSectionActive('coherence'),
      },
      {
        key: 'agreements',
        label: tCommon('Agreements'),
        icon: FileCheck2,
        href: `/${lang}/dho/${spaceSlug}/agreements`,
        active: isSectionActive('agreements'),
      },
      {
        key: 'members',
        label: tCommon('Members'),
        icon: UsersRound,
        href: `/${lang}/dho/${spaceSlug}/members`,
        active: isSectionActive('members'),
      },
      {
        key: 'treasury',
        label: tCommon('Treasury'),
        icon: Coins,
        href: `/${lang}/dho/${spaceSlug}/treasury`,
        active: isSectionActive('treasury'),
      },
      {
        key: 'rewards',
        label: tTreasury('rewardsSection.title'),
        icon: HandCoins,
        href: `/${lang}/dho/${spaceSlug}/rewards`,
        active: isSectionActive('rewards'),
      },
      ...(enableSpaceMemory
        ? [
            {
              key: 'memory',
              label: tCoherence('spaceMemory'),
              icon: MemoryIcon,
              href: `/${lang}/dho/${spaceSlug}/memory`,
              active: isSectionActive('memory'),
            },
          ]
        : []),
    ];
  }, [
    enableSpaceMemory,
    isSectionActive,
    lang,
    spaceSlug,
    tCommon,
    tCoherence,
    tSelectNavigation,
    tTreasury,
  ]);
  const isSpaceSettingsActive = useMemo(
    () =>
      Boolean(spaceSlug) &&
      pathname.includes(`/dho/${spaceSlug}/`) &&
      pathname.includes('/select-settings-action'),
    [pathname, spaceSlug],
  );
  const isSpaceSettingsDisabled =
    isUserSpaceStateLoading ||
    userSpaceState !== UserSpaceState.LOGGED_IN_SPACE;
  const spaceSettingsItem = useMemo(() => {
    if (!spaceSlug) return null;
    return {
      key: 'space-settings',
      label: tModalAside('spaceSettings'),
      icon: Settings,
      href: `/${lang}/dho/${spaceSlug}/agreements/select-settings-action`,
      active: isSpaceSettingsActive,
      disabled: isSpaceSettingsDisabled,
    };
  }, [
    isSpaceSettingsActive,
    isSpaceSettingsDisabled,
    lang,
    spaceSlug,
    tModalAside,
  ]);

  useEffect(() => {
    if (!recentSpacesError) return;
    console.warn('[AiLeftPanel] spaces fetch failed', {
      slugs: recentSpaceLookupSlugs,
      error: recentSpacesError,
    });
  }, [recentSpacesError, recentSpaceLookupSlugs]);

  useEffect(() => {
    const unsubscribe = subscribeRecentSpaceSlugs((slugs) =>
      setRecentSpaceSlugs(slugs),
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!spaceSlug) return;
    setRecentSpaceSlugs(syncRecentSpacesForActiveSlug(spaceSlug));
  }, [spaceSlug]);

  const recentSpaces = useMemo(() => {
    if (recentSpaceSlugs.length === 0 || recentSpacesData.length === 0)
      return [];
    const bySlug = new Map(
      recentSpacesData.map((space) => [space.slug, space]),
    );
    return recentSpaceSlugs
      .map((slug) => bySlug.get(slug))
      .filter((space): space is Space => space != null)
      .filter((space) => space.slug !== spaceSlug)
      .slice(0, MAX_VISIBLE_RECENT_SPACES);
  }, [recentSpaceSlugs, recentSpacesData, spaceSlug]);

  const suggestionItems = useMemo(
    () =>
      [
        ...(!spaceSlug
          ? ([
              {
                id: 'createSpace',
                prompt: t('suggestions.createSpace'),
                tagLabel: t('suggestionTags.createSpace'),
              },
              {
                id: 'createEcosystem',
                prompt: t('suggestions.createEcosystem'),
                tagLabel: t('suggestionTags.createEcosystem'),
              },
            ] as const)
          : []),
        {
          id: 'spaceHealth',
          prompt: t('suggestions.spaceHealth'),
          tagLabel: t('suggestionTags.spaceHealth'),
        },
        {
          id: 'nextSignal',
          prompt: t('suggestions.nextSignal'),
          tagLabel: t('suggestionTags.nextSignal'),
        },
        {
          id: 'blindSpot',
          prompt: t('suggestions.blindSpot'),
          tagLabel: t('suggestionTags.blindSpot'),
        },
        {
          id: 'summarizeDiscussion',
          prompt: t('suggestions.summarizeDiscussion'),
          tagLabel: t('suggestionTags.summarizeDiscussion'),
        },
        {
          id: 'spaceMemory',
          prompt: t('suggestions.spaceMemory'),
          tagLabel: t('suggestionTags.spaceMemory'),
        },
        {
          id: 'valueFlows',
          prompt: t('suggestions.valueFlows'),
          tagLabel: t('suggestionTags.valueFlows'),
        },
      ] as const,
    [spaceSlug, t],
  );

  const handleOverlayClose = useCallback(() => {
    hideAiOverlay();
    closeAiPanel();
  }, [closeAiPanel, hideAiOverlay]);

  const handleMenuItemNavigation = useCallback(() => {
    if (!isCompactHeader) return;
    handleOverlayClose();
  }, [isCompactHeader, handleOverlayClose]);

  const renderSectionNavItem = useCallback(
    (item: NavItem, mode: 'expanded' | 'collapsed', keyPrefix: string) => {
      const showLabel = mode === 'expanded';
      const isDisabled = item.disabled === true;
      const iconClassName = `h-4 w-4${item.active ? ' text-accent-9' : ''}`;
      const labelClassName = `min-w-0 truncate${
        showLabel && item.active ? ' text-accent-9' : ''
      }`;
      const rowClassName = `${MENU_ROW_LINK_BASE_CLASS} ${
        showLabel ? MENU_ROW_LINK_EXPANDED_CLASS : MENU_ROW_LINK_COLLAPSED_CLASS
      } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`;

      return (
        <SidebarMenuItem key={`${keyPrefix}-${item.key}`}>
          <SidebarMenuButton
            asChild
            tooltip={!showLabel ? item.label : undefined}
            isActive={item.active}
            className={MENU_BUTTON_CLASS}
          >
            {isDisabled ? (
              <span
                aria-label={item.label}
                aria-disabled="true"
                className={rowClassName}
              >
                <span className={ICON_COLUMN_CLASS}>
                  <item.icon className={iconClassName} />
                </span>
                {showLabel ? (
                  <span className={labelClassName}>{item.label}</span>
                ) : null}
              </span>
            ) : (
              <Link
                href={item.href}
                onClick={handleMenuItemNavigation}
                aria-label={item.label}
                aria-current={item.active ? 'page' : undefined}
                className={rowClassName}
              >
                <span className={ICON_COLUMN_CLASS}>
                  <item.icon className={iconClassName} />
                </span>
                {showLabel ? (
                  <span className={labelClassName}>{item.label}</span>
                ) : null}
              </Link>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    },
    [handleMenuItemNavigation],
  );

  const renderRecentSpaceItem = useCallback(
    (
      space: Space,
      index: number,
      mode: 'expanded' | 'collapsed',
      keyPrefix: string,
    ) => {
      const showLabel = mode === 'expanded';
      const isRecentActive = space.slug === spaceSlug;
      const href = getDhoSpaceContextPath({
        pathname,
        lang,
        spaceSlug: space.slug,
      });
      const safeHref = href ?? `/${lang}/dho/${space.slug}/agreements`;
      const recentSpaceIcon = resolveSpaceDisplayLogoUrl(
        space,
        resolvedTheme === 'dark' ? 'dark' : 'light',
      );

      return (
        <SidebarMenuItem key={`${keyPrefix}-${space.slug}-${index}`}>
          <SidebarMenuButton
            asChild
            tooltip={!showLabel ? space.title : undefined}
            isActive={isRecentActive}
            className={MENU_BUTTON_CLASS}
          >
            <Link
              href={safeHref}
              onClick={handleMenuItemNavigation}
              aria-label={space.title}
              aria-current={isRecentActive ? 'page' : undefined}
              className={`${MENU_ROW_LINK_BASE_CLASS} ${
                showLabel
                  ? MENU_ROW_LINK_EXPANDED_CLASS
                  : MENU_ROW_LINK_COLLAPSED_CLASS
              }`}
            >
              <span className={ICON_COLUMN_CLASS}>
                <span
                  className={`${RECENT_SPACE_AVATAR_CLASS} ${
                    isRecentActive
                      ? 'ring-accent-9/45'
                      : 'group-hover:ring-border/80'
                  }`}
                >
                  {recentSpaceIcon ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={recentSpaceIcon}
                        alt={space.title}
                        className="block h-full w-full rounded-full object-cover object-center"
                      />
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {space.title.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
              {showLabel ? (
                <span className="min-w-0 truncate">{space.title}</span>
              ) : null}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    },
    [lang, pathname, resolvedTheme, spaceSlug, handleMenuItemNavigation],
  );

  const renderRecentSpacesSection = useCallback(
    (mode: 'expanded' | 'collapsed', keyPrefix: string) => {
      return (
        <SidebarGroup
          className={`${
            spaceSettingsItem ? 'p-2 pb-4 pt-2' : 'mt-auto p-2 pb-4'
          }`}
        >
          {mode === 'expanded' ? (
            <SidebarGroupLabel className="pointer-events-none">
              {tSpaces('recentlyVisitedSpacesLabel')}
            </SidebarGroupLabel>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {recentSpaces.map((space, index) =>
                renderRecentSpaceItem(
                  space,
                  index,
                  mode,
                  `${keyPrefix}-recent`,
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    },
    [recentSpaces, renderRecentSpaceItem, spaceSettingsItem, tSpaces],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => {
          let token: string | undefined;
          try {
            token = (await getAccessToken?.()) ?? undefined;
          } catch (error) {
            console.error('[AiLeftPanel] getAccessToken failed for transport', {
              error,
            });
          }
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Per-request body comes from buildMessageOptions — keep transport stable
        // so useChat does not reinitialize when onboarding context updates.
        body: {},
      }),
    [getAccessToken],
  );

  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    clearError,
    setMessages,
  } = useChat({
    transport,
    onError: (chatError) => {
      console.error('[AiLeftPanel][useChat]', chatError);
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  const hasUserMessage = useMemo(
    () =>
      (messages as ChatUIMessage[]).some((message) => message.role === 'user'),
    [messages],
  );

  useEffect(() => {
    if (onboardingHandoffHydratedRef.current) return;
    if (!consumeOnboardingOpenAiPanelPending()) return;
    onboardingHandoffHydratedRef.current = true;
    skipNextChatResetRef.current = true;

    const storedMessages = readOnboardingChatMessages();
    const storedContext = readOnboardingConversationContext();
    if (storedContext) {
      setOnboardingContext(storedContext);
    }
    if (storedMessages?.length) {
      setMessages(
        storedMessages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts ?? [],
        })) as Parameters<typeof setMessages>[0],
      );
    }
    openAiPanel();
    setAiOverlayVisible(false);

    const continuationPrompt = consumeOnboardingContinuationPrompt();
    if (continuationPrompt) {
      pendingSeedPromptRef.current = continuationPrompt;
    }
  }, [openAiPanel, setAiOverlayVisible, setMessages]);

  useEffect(() => {
    const nextSlug = spaceSlug?.trim() || null;
    const previousSlug = lastChatSpaceSlugRef.current;
    if (previousSlug === nextSlug) return;

    if (skipNextChatResetRef.current) {
      skipNextChatResetRef.current = false;
      lastChatSpaceSlugRef.current = nextSlug;
      return;
    }

    lastChatSpaceSlugRef.current = nextSlug;
    lastMcpNavigationTargetSpaceSlugRef.current = null;
    lastAutoNavigationKeyRef.current = null;
    stop();
    clearError();
    setMessages([]);
  }, [clearError, setMessages, spaceSlug, stop]);

  const buildMessageOptions = useCallback(
    async (contextOverride?: OnboardingConversationContext | undefined) => {
      let token: string | undefined;
      try {
        token = (await getAccessToken?.()) ?? undefined;
      } catch (error) {
        console.error(
          '[AiLeftPanel] getAccessToken failed for message options',
          {
            error,
          },
        );
      }
      const hdrs: Record<string, string> = {};
      if (token) hdrs['Authorization'] = `Bearer ${token}`;
      const activeContext = contextOverride ?? onboardingContext;
      const { body } = resolveChatTransportBody({
        spaceSlug,
        activeSpaceTitle: activeSpaceName,
        onboardingContext: activeContext,
        isOnboardingPath,
      });
      return { body, headers: hdrs };
    },
    [
      activeSpaceName,
      getAccessToken,
      isOnboardingPath,
      onboardingContext,
      spaceSlug,
    ],
  );

  useEffect(() => {
    if (!isSpaceSetupContext(onboardingContext)) return;
    const { staleOnboardingContext } = resolveChatTransportBody({
      spaceSlug,
      activeSpaceTitle: activeSpaceName,
      onboardingContext,
      isOnboardingPath,
    });
    if (!staleOnboardingContext) return;

    const activeSlug = spaceSlug?.trim();
    const isPostCreate =
      onboardingContext.setupPhase === 'verify' ||
      onboardingContext.setupPhase === 'execute';
    if (
      isPostCreate &&
      activeSlug &&
      !onboardingContext.createdSpaceSlug?.trim()
    ) {
      const patched: OnboardingConversationContext = {
        ...onboardingContext,
        createdSpaceSlug: activeSlug,
      };
      setOnboardingContext(patched);
      saveOnboardingConversationContext(patched);
      return;
    }

    clearOnboardingConversationContext();
    setOnboardingContext(undefined);
  }, [activeSpaceName, isOnboardingPath, onboardingContext, spaceSlug]);

  useEffect(() => {
    const onSeed = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | {
            prompt?: string;
            context?: OnboardingConversationContext;
            attachments?: File[];
          }
        | undefined;
      const prompt = detail?.prompt?.trim();
      const context = detail?.context;
      if (!context || context.mode !== ONBOARDING_SETUP_MODE) return;
      const attachments = Array.isArray(detail?.attachments)
        ? detail.attachments.filter(
            (file): file is File => file instanceof File,
          )
        : [];
      if (!prompt && attachments.length === 0) return;

      dispatchAiOnboardingSeedAck({ stage: 'received' });
      setOnboardingContext(context);
      setInput(prompt ?? '');
      setDraftAttachments(
        attachments.map((file) => ({
          id:
            typeof globalThis.crypto?.randomUUID === 'function'
              ? globalThis.crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          kind: file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
            ? 'audio'
            : 'file',
          previewUrl: URL.createObjectURL(file),
          spoiler: false,
        })),
      );
      pendingSeedPromptRef.current = prompt ?? null;
      pendingSeedAttachmentsRef.current = attachments;
      openAiPanel();
      setAiOverlayVisible(false);
    };
    window.addEventListener(AI_ONBOARDING_SEED_EVENT, onSeed as EventListener);
    return () => {
      window.removeEventListener(
        AI_ONBOARDING_SEED_EVENT,
        onSeed as EventListener,
      );
    };
  }, [openAiPanel, setAiOverlayVisible]);

  useEffect(() => {
    if (pendingSeedPromptRef.current == null) return;
    if (isStreaming) return;
    const seededPrompt = pendingSeedPromptRef.current ?? '';
    const seededAttachments = pendingSeedAttachmentsRef.current;
    if (!seededPrompt.trim() && seededAttachments.length === 0) {
      pendingSeedPromptRef.current = null;
      pendingSeedAttachmentsRef.current = [];
      return;
    }
    pendingSeedPromptRef.current = null;
    pendingSeedAttachmentsRef.current = [];

    void (async () => {
      try {
        dispatchAiOnboardingSeedAck({ stage: 'sending' });
        clearError();
        const options = await buildMessageOptions();
        const attachmentParts =
          seededAttachments.length > 0
            ? await convertFilesToParts(seededAttachments)
            : [];
        const textParts = seededPrompt.trim()
          ? [{ type: 'text' as const, text: seededPrompt }]
          : [];
        await sendMessage(
          { role: 'user', parts: [...textParts, ...attachmentParts] },
          options,
        );
        // Handoff is successful once the request is accepted/submitted.
        // Do not block onboarding hero feedback on full model completion.
        dispatchAiOnboardingSeedAck({ ok: true, stage: 'sent' });
        setInput('');
        setDraftAttachments([]);
      } catch (seedError) {
        console.error('[AiLeftPanel] onboarding seed send failed:', seedError);
        setInput(seededPrompt);
        setDraftAttachments(
          seededAttachments.map((file) => ({
            id:
              typeof globalThis.crypto?.randomUUID === 'function'
                ? globalThis.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            kind: file.type.startsWith('image/')
              ? 'image'
              : file.type.startsWith('video/')
              ? 'video'
              : file.type.startsWith('audio/')
              ? 'audio'
              : 'file',
            previewUrl: URL.createObjectURL(file),
            spoiler: false,
          })),
        );
        dispatchAiOnboardingSeedAck({
          ok: false,
          stage: 'error',
          reason: 'send_failed',
        });
      }
    })();
  }, [buildMessageOptions, clearError, isStreaming, sendMessage]);

  useEffect(() => {
    if (!isSpaceSetupContext(onboardingContext)) return;

    const latestCreatedSpaceSlug = [...messages]
      .reverse()
      .flatMap((message) => message.parts ?? [])
      .find((part) => {
        if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) {
          return false;
        }
        const toolPart = part as {
          state?: string;
          output?: { ok?: boolean; space?: { slug?: string } };
        };
        return (
          toolPart.state === 'output-available' &&
          toolPart.output?.ok === true &&
          typeof toolPart.output?.space?.slug === 'string' &&
          toolPart.output.space.slug.length > 0
        );
      }) as
      | {
          output?: { space?: { slug?: string } };
        }
      | undefined;

    const createdSlug = latestCreatedSpaceSlug?.output?.space?.slug?.trim();
    if (!createdSlug) return;
    if (lastAutoTransitionSpaceSlugRef.current === createdSlug) return;
    lastAutoTransitionSpaceSlugRef.current = createdSlug;

    const nextContext: OnboardingConversationContext = {
      ...onboardingContext,
      setupPhase:
        onboardingContext.setupJourney === 'ecosystem' ? 'execute' : 'verify',
      createdSpaceSlug: createdSlug,
      ...(onboardingContext.setupJourney === 'ecosystem'
        ? { ecosystemRootSlug: createdSlug }
        : {}),
    };
    setOnboardingContext(nextContext);
    saveOnboardingConversationContext(nextContext);
    openAiPanel();
    setAiOverlayVisible(false);
    const continuationPrompt = getPostOnboardingContinuationPrompt(
      onboardingContext.setupJourney,
    );
    if (continuationPrompt) {
      pendingSeedPromptRef.current = continuationPrompt;
    }
    router.push(
      getPostOnboardingLandingPath(
        lang,
        createdSlug,
        onboardingContext.setupJourney,
      ),
    );
  }, [
    lang,
    messages,
    onboardingContext,
    openAiPanel,
    router,
    setAiOverlayVisible,
  ]);

  useEffect(() => {
    const isCompletedToolState = (state: unknown) => {
      if (typeof state !== 'string') return true;
      return (
        state === 'output-available' ||
        state === 'output_available' ||
        state === 'done' ||
        state === 'completed'
      );
    };

    const findLatestNavigationTarget = () => {
      for (
        let messageIndex = messages.length - 1;
        messageIndex >= 0;
        messageIndex -= 1
      ) {
        const message = messages[messageIndex];
        if (!message) continue;

        const messageWithToolInvocations = message as {
          toolInvocations?: unknown;
        };
        const toolInvocations = Array.isArray(
          messageWithToolInvocations.toolInvocations,
        )
          ? messageWithToolInvocations.toolInvocations
          : [];
        for (
          let invocationIndex = toolInvocations.length - 1;
          invocationIndex >= 0;
          invocationIndex -= 1
        ) {
          const invocation = toolInvocations[invocationIndex];
          if (!invocation || typeof invocation !== 'object') continue;
          const toolName =
            (typeof invocation.toolName === 'string' && invocation.toolName) ||
            (typeof invocation.tool === 'string' && invocation.tool) ||
            '';
          if (toolName !== 'mcp_navigation') continue;
          if (!isCompletedToolState(invocation.state)) continue;
          const output =
            (invocation.result as Record<string, unknown> | undefined) ??
            (invocation.output as Record<string, unknown> | undefined);
          const navigation = output?.navigation as
            | { href?: string; open_in_new_tab?: boolean }
            | undefined;
          const href = navigation?.href?.trim();
          if (!href) continue;
          return {
            href,
            openInNewTab: navigation?.open_in_new_tab === true,
            key: `${message.id}:toolInvocation:${invocationIndex}:${href}`,
          };
        }

        const parts = Array.isArray(message.parts) ? message.parts : [];
        for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
          const part = parts[partIndex];
          if (!part || typeof part !== 'object') continue;
          if (part.type !== 'tool-mcp_navigation') continue;
          if (!isCompletedToolState((part as { state?: unknown }).state))
            continue;
          const toolPart = part as {
            output?: {
              ok?: boolean;
              navigation?: {
                href?: string;
                open_in_new_tab?: boolean;
              };
            };
          };
          const href = toolPart.output?.navigation?.href?.trim();
          if (!href || toolPart.output?.ok !== true) continue;
          return {
            href,
            openInNewTab: toolPart.output.navigation?.open_in_new_tab === true,
            key: `${message.id}:part:${partIndex}:${href}`,
          };
        }
      }
      return null;
    };

    const navigationTarget = findLatestNavigationTarget();
    const href = navigationTarget?.href;
    if (!href) return;
    const navigationKey = navigationTarget?.key ?? `unknown:${href}`;
    if (lastAutoNavigationKeyRef.current === navigationKey) return;
    lastAutoNavigationKeyRef.current = navigationKey;

    const openInNewTab = navigationTarget?.openInNewTab === true;
    const isExternal = /^https?:\/\//i.test(href);
    if (openInNewTab || isExternal) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    lastMcpNavigationTargetSpaceSlugRef.current =
      getDhoSpaceSlugFromPathname(href) ?? null;
    // Keep the AI panel expanded when MCP navigation redirects internally.
    // This prevents perceived panel "close" regressions during route changes.
    openAiPanel();
    setAiOverlayVisible(false);
    router.push(href);
  }, [messages, openAiPanel, router, setAiOverlayVisible]);

  useEffect(() => {
    if (!isSpaceSetupContext(onboardingContext)) return;
    const slug =
      typeof walletCreatedSpace?.slug === 'string'
        ? walletCreatedSpace.slug.trim()
        : '';
    if (!slug) return;
    if (lastAutoTransitionSpaceSlugRef.current === slug) return;
    lastAutoTransitionSpaceSlugRef.current = slug;
    const isEcosystem = onboardingContext.setupJourney === 'ecosystem';
    const nextContext: OnboardingConversationContext = {
      ...onboardingContext,
      setupPhase: isEcosystem ? 'execute' : 'verify',
      createdSpaceSlug: slug,
      ...(isEcosystem ? { ecosystemRootSlug: slug } : {}),
    };
    setOnboardingContext(nextContext);
    saveOnboardingConversationContext(nextContext);
    openAiPanel();
    setAiOverlayVisible(false);
    const continuationPrompt = getPostOnboardingContinuationPrompt(
      onboardingContext.setupJourney,
    );
    if (continuationPrompt) {
      pendingSeedPromptRef.current = continuationPrompt;
    }
    router.push(
      getPostOnboardingLandingPath(lang, slug, onboardingContext.setupJourney),
    );
  }, [
    lang,
    onboardingContext,
    openAiPanel,
    router,
    setAiOverlayVisible,
    walletCreatedSpace?.slug,
  ]);

  useEffect(() => {
    if (!isSpaceSetupContext(onboardingContext)) return;
    const resolved = extractOnboardingVisualAssetsFromMessages(messages);
    if (!resolved) return;
    if (
      onboardingContext.visualAssets?.logoUrl === resolved.logoUrl &&
      onboardingContext.visualAssets?.leadImageUrl === resolved.leadImageUrl
    ) {
      return;
    }
    const nextContext: OnboardingConversationContext = {
      ...onboardingContext,
      visualAssets: resolved,
    };
    setOnboardingContext(nextContext);
    saveOnboardingConversationContext(nextContext);
  }, [messages, onboardingContext]);

  useEffect(() => {
    if (!isSpaceSetupContext(onboardingContext)) return;
    if (aiWalletCreateInFlightRef.current) return;

    const latestWalletCreatePayload = [...messages]
      .reverse()
      .flatMap((message) =>
        (message.parts ?? []).map((part, index) => ({
          messageId: message.id,
          index,
          part,
        })),
      )
      .find(({ part }) => {
        if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) {
          return false;
        }
        if (part.type !== 'tool-create_space_from_onboarding') {
          return false;
        }
        const toolPart = part as {
          state?: string;
          output?: {
            ok?: boolean;
            requires_wallet_signature?: boolean;
            create_payload?: Record<string, unknown>;
          };
        };
        return (
          toolPart.state === 'output-available' &&
          toolPart.output?.ok === true &&
          toolPart.output?.requires_wallet_signature === true &&
          typeof toolPart.output?.create_payload === 'object'
        );
      }) as
      | {
          messageId?: string;
          index?: number;
          part?: {
            output?: {
              create_payload?: {
                title?: string;
                description?: string;
                slug?: string;
                parent_id?: number | null;
                flags?: string[];
                links?: string[];
                categories?: string[];
                lead_image_url?: string | null;
                logo_url?: string | null;
                ecosystem_logo_light_url?: string | null;
                ecosystem_logo_dark_url?: string | null;
              };
            };
          };
        }
      | undefined;

    const payloadKey = latestWalletCreatePayload
      ? `${latestWalletCreatePayload.messageId ?? 'm'}:${
          latestWalletCreatePayload.index ?? 0
        }`
      : null;
    if (payloadKey && handledWalletPayloadKeyRef.current === payloadKey) return;
    const payload = mergeVisualAssetsIntoCreatePayload(
      (latestWalletCreatePayload?.part?.output?.create_payload ?? {}) as Record<
        string,
        unknown
      >,
      messages,
      onboardingContext.visualAssets,
    );
    if (!payload?.title || !payload.description) return;
    const normalizedTitle =
      typeof payload.title === 'string' ? payload.title.trim() : '';
    const normalizedDescription =
      typeof payload.description === 'string' ? payload.description.trim() : '';
    if (!normalizedTitle || !normalizedDescription) return;
    const logoUrl =
      typeof payload.logo_url === 'string' ? payload.logo_url.trim() : '';
    const leadImageUrl =
      typeof payload.lead_image_url === 'string'
        ? payload.lead_image_url.trim()
        : '';
    if (!logoUrl || !leadImageUrl) {
      console.warn(
        '[AiLeftPanel] Skipping wallet create — logo and banner URLs are required.',
        { title: payload.title },
      );
      return;
    }
    const normalizedFlags: SpaceFlags[] = Array.isArray(payload.flags)
      ? (payload.flags as SpaceFlags[])
      : [];
    const normalizedCategories: Category[] = Array.isArray(payload.categories)
      ? (payload.categories as Category[])
      : [];

    if (onboardingContext) {
      const executeContext: OnboardingConversationContext = {
        ...onboardingContext,
        setupPhase: 'execute',
      };
      setOnboardingContext(executeContext);
      saveOnboardingConversationContext(executeContext);
    }

    aiWalletCreateInFlightRef.current = true;
    void (async () => {
      try {
        await createSpaceWithWalletFlow({
          title: normalizedTitle,
          description: normalizedDescription,
          slug: typeof payload.slug === 'string' ? payload.slug : '',
          parentId:
            typeof payload.parent_id === 'number' ? payload.parent_id : null,
          flags: normalizedFlags,
          links: Array.isArray(payload.links) ? payload.links : [],
          categories: normalizedCategories,
          logoUrl,
          leadImage: leadImageUrl,
          ...(typeof payload.ecosystem_logo_light_url === 'string'
            ? { ecosystemLogoUrlLight: payload.ecosystem_logo_light_url }
            : {}),
          ...(typeof payload.ecosystem_logo_dark_url === 'string'
            ? { ecosystemLogoUrlDark: payload.ecosystem_logo_dark_url }
            : {}),
          ...onboardingLocationFromCreatePayload(payload),
          ...onboardingTransparencyFromCreatePayload(payload),
          ...onboardingJoinMethodFromCreatePayload(payload),
        });
        if (payloadKey) handledWalletPayloadKeyRef.current = payloadKey;
      } catch (walletFlowError) {
        console.error(
          '[AiLeftPanel] wallet-based onboarding space creation failed:',
          walletFlowError,
        );
      } finally {
        aiWalletCreateInFlightRef.current = false;
      }
    })();
  }, [createSpaceWithWalletFlow, messages, onboardingContext]);

  useEffect(() => {
    if (aiWalletProposalInFlightRef.current) return;

    const latestWalletProposalPayload = [...messages]
      .reverse()
      .flatMap((message) =>
        (message.parts ?? []).map((part, index) => ({
          messageId: message.id,
          index,
          part,
        })),
      )
      .find(({ part }) => {
        if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) {
          return false;
        }
        if (part.type !== 'tool-create_space_setup_proposal') {
          return false;
        }
        const toolPart = part as {
          state?: string;
          output?: {
            ok?: boolean;
            requires_wallet_signature?: boolean;
            create_payload?: Record<string, unknown>;
          };
        };
        return (
          toolPart.state === 'output-available' &&
          toolPart.output?.ok === true &&
          toolPart.output?.requires_wallet_signature === true &&
          typeof toolPart.output?.create_payload === 'object'
        );
      }) as
      | {
          messageId?: string;
          index?: number;
          part?: {
            output?: {
              create_payload?: {
                title?: string;
                description?: string;
                space_id?: number;
                web3_space_id?: number;
                creator_id?: number;
                label?: string;
              };
            };
          };
        }
      | undefined;

    const payloadKey = latestWalletProposalPayload
      ? `${latestWalletProposalPayload.messageId ?? 'm'}:${
          latestWalletProposalPayload.index ?? 0
        }`
      : null;
    if (
      payloadKey &&
      handledWalletProposalPayloadKeyRef.current === payloadKey
    ) {
      return;
    }
    const payload = latestWalletProposalPayload?.part?.output?.create_payload;
    if (
      !payload?.title ||
      !payload.description ||
      typeof payload.space_id !== 'number' ||
      typeof payload.web3_space_id !== 'number' ||
      typeof payload.creator_id !== 'number'
    ) {
      return;
    }
    if (payloadKey) handledWalletProposalPayloadKeyRef.current = payloadKey;

    aiWalletProposalInFlightRef.current = true;
    void (async () => {
      try {
        await createAgreementWithWalletFlow({
          title: payload.title!.trim(),
          description: payload.description!.trim(),
          spaceId: payload.space_id!,
          creatorId: payload.creator_id!,
          label: payload.label ?? 'space setup',
          web3SpaceId: payload.web3_space_id!,
        });
      } catch (walletFlowError) {
        console.error(
          '[AiLeftPanel] wallet-based proposal creation failed:',
          walletFlowError,
        );
      } finally {
        aiWalletProposalInFlightRef.current = false;
      }
    })();
  }, [createAgreementWithWalletFlow, messages]);

  useEffect(() => {
    if (
      blockSpaceAiForInteraction ||
      !error ||
      status !== 'error' ||
      autoRetryingRef.current
    ) {
      return;
    }

    const errorMessage =
      error instanceof Error ? error.message.toLowerCase() : String(error);
    const looksLikeTransientNetworkError =
      errorMessage.includes('network') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('err_network_changed');
    if (!looksLikeTransientNetworkError) return;

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');
    const retryKey = lastUserMessage?.id ?? `fallback-${messages.length}`;

    if (lastAutoRetriedMessageIdRef.current === retryKey) return;
    lastAutoRetriedMessageIdRef.current = retryKey;
    autoRetryingRef.current = true;

    void (async () => {
      try {
        clearError();
        const options = await buildMessageOptions();
        await sendMessage(undefined, options);
      } catch (retryError) {
        console.error('[AiLeftPanel] automatic chat retry failed:', retryError);
      } finally {
        autoRetryingRef.current = false;
      }
    })();
  }, [
    blockSpaceAiForInteraction,
    buildMessageOptions,
    clearError,
    error,
    messages,
    sendMessage,
    status,
  ]);

  useEffect(() => {
    if (blockSpaceAiForInteraction) {
      clearError();
    }
    // clearError identity from useChat is unstable — only react to block toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [blockSpaceAiForInteraction]);

  const handleSend = useCallback(async () => {
    if (blockSpaceAiForInteraction) return;
    if ((!input.trim() && draftAttachments.length === 0) || isStreaming) return;
    const text = input;
    const attachments = [...draftAttachments];
    setInput('');
    setDraftAttachments([]);
    try {
      clearError();
      const nextContext = resolveSetupContextForUserMessage(
        text,
        onboardingContext,
        lang,
      );
      const options = await buildMessageOptions(nextContext);
      let attachmentParts: Array<
        | { type: 'text'; text: string }
        | { type: 'file'; mediaType: string; url: string }
      > = [];
      if (
        attachments.length > 0 &&
        activeSpaceChatRoomId &&
        matrix.isMatrixAvailable &&
        matrix.isAuthenticated
      ) {
        const joinedRoomId = await matrix.joinRoom(activeSpaceChatRoomId);
        await matrix.sendMessage({
          roomId: joinedRoomId,
          message: text.trim(),
          attachments: attachments.map((att) => ({
            file: att.file,
            kind:
              att.kind === 'image'
                ? 'image'
                : att.kind === 'audio'
                ? 'audio'
                : 'file',
            spoiler: att.spoiler,
          })),
        });
        attachmentParts = [
          {
            type: 'text',
            text: `Uploaded files: ${attachments
              .map((att) => att.file.name)
              .join(', ')}`,
          },
        ];
      } else if (attachments.length > 0) {
        attachmentParts = await convertFilesToParts(
          attachments.map((att) => att.file),
        );
      }
      const textParts = text.trim() ? [{ type: 'text' as const, text }] : [];
      if (spaceSlug && text.trim()) {
        recordMobilizedAiAgentsForQuestion(spaceSlug, text.trim());
      }
      if (DEBUG)
        console.log('[AiLeftPanel] sendMessage', {
          text,
          attachmentCount: attachments.length,
          spaceSlug,
          persistedToMatrix: Boolean(
            attachments.length &&
              activeSpaceChatRoomId &&
              matrix.isMatrixAvailable &&
              matrix.isAuthenticated,
          ),
        });
      await sendMessage(
        { role: 'user', parts: [...textParts, ...attachmentParts] },
        options,
      );
      if (nextContext && nextContext !== onboardingContext) {
        setOnboardingContext(nextContext);
        saveOnboardingConversationContext(nextContext);
      }
      for (const att of attachments) {
        if (att.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(att.previewUrl);
        }
      }
    } catch (err) {
      console.error('[AiLeftPanel] sendMessage error:', err);
      setInput(text);
      setDraftAttachments(attachments);
    }
  }, [
    input,
    draftAttachments,
    isStreaming,
    sendMessage,
    buildMessageOptions,
    clearError,
    activeSpaceChatRoomId,
    matrix,
    onboardingContext,
    blockSpaceAiForInteraction,
    lang,
  ]);

  const handleStop = useCallback(() => {
    void stop();
  }, [stop]);

  useEffect(() => {
    return () => {
      for (const att of draftAttachmentsRef.current) {
        if (att.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(att.previewUrl);
        }
      }
    };
  }, []);

  const handleSuggestionSelect = useCallback(
    async (text: string) => {
      if (blockSpaceAiForInteraction) return;
      try {
        clearError();
        if (spaceSlug && text.trim()) {
          recordMobilizedAiAgentsForQuestion(spaceSlug, text.trim());
        }
        const nextContext = resolveSetupContextForUserMessage(
          text,
          onboardingContext,
          lang,
        );
        const options = await buildMessageOptions(nextContext);
        if (DEBUG)
          console.log('[AiLeftPanel] suggestion selected', {
            text,
            spaceSlug,
          });
        await sendMessage(
          { role: 'user', parts: [{ type: 'text', text }] },
          options,
        );
        if (nextContext && nextContext !== onboardingContext) {
          setOnboardingContext(nextContext);
          saveOnboardingConversationContext(nextContext);
        }
      } catch (err) {
        console.error('[AiLeftPanel] suggestion sendMessage error:', err);
      }
    },
    [
      blockSpaceAiForInteraction,
      sendMessage,
      buildMessageOptions,
      clearError,
      lang,
      onboardingContext,
      spaceSlug,
    ],
  );

  const handleActionReplySelect = useCallback(
    async (text: string) => {
      if (blockSpaceAiForInteraction) return;
      try {
        clearError();
        const nextContext = resolveSetupContextForUserMessage(
          text,
          onboardingContext,
          lang,
        );
        const options = await buildMessageOptions(nextContext);
        await sendMessage(
          { role: 'user', parts: [{ type: 'text', text }] },
          options,
        );
        if (nextContext && nextContext !== onboardingContext) {
          setOnboardingContext(nextContext);
          saveOnboardingConversationContext(nextContext);
        }
      } catch (err) {
        console.error('[AiLeftPanel] action reply sendMessage error:', err);
      }
    },
    [
      blockSpaceAiForInteraction,
      buildMessageOptions,
      clearError,
      lang,
      onboardingContext,
      sendMessage,
    ],
  );

  const sendOnboardingLocationMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
      saveOnboardingConversationContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingLocationMessageLabels = useMemo(
    () => ({
      withLabel: (label: string) =>
        t('onboardingLocationSetWithLabel', { label }),
      withCoordinates: (latitude: number, longitude: number) =>
        t('onboardingLocationSetWithCoordinates', { latitude, longitude }),
      fallback: t('onboardingLocationSetFallback'),
    }),
    [t],
  );

  const handleOnboardingLocationConfirm = useCallback(
    async (value: SpaceLocationValue) => {
      if (isStreaming) return;
      try {
        clearError();
        const baseContext = ensureSpaceSetupContext(onboardingContext, lang);
        const message = formatOnboardingLocationSubmitMessage(
          value,
          onboardingLocationMessageLabels,
        );
        const nextContext = applyOnboardingLocationToContext(
          baseContext,
          onboardingSpaceLocationFromPicker(value),
          message,
        );
        await sendOnboardingLocationMessage(message, nextContext);
      } catch (err) {
        console.error('[AiLeftPanel] location confirm sendMessage error:', err);
      }
    },
    [
      clearError,
      isStreaming,
      lang,
      onboardingContext,
      onboardingLocationMessageLabels,
      sendOnboardingLocationMessage,
    ],
  );

  const handleOnboardingLocationSkip = useCallback(async () => {
    if (isStreaming) return;
    try {
      clearError();
      const baseContext = ensureSpaceSetupContext(onboardingContext, lang);
      const message = t('onboardingLocationSkipMessage');
      const nextContext = applyOnboardingLocationToContext(
        baseContext,
        skippedOnboardingSpaceLocation(),
        message,
      );
      await sendOnboardingLocationMessage(message, nextContext);
    } catch (err) {
      console.error('[AiLeftPanel] location skip sendMessage error:', err);
    }
  }, [
    clearError,
    isStreaming,
    lang,
    onboardingContext,
    sendOnboardingLocationMessage,
    t,
  ]);

  const sendOnboardingActivationMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
      saveOnboardingConversationContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const sendOnboardingSetupJourneyMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
      saveOnboardingConversationContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingSetupJourneyMessageLabels = useMemo(
    () => ({
      singleSpace: t('onboardingSetupJourneySetSingle'),
      ecosystem: t('onboardingSetupJourneySetEcosystem'),
    }),
    [t],
  );

  const handleOnboardingSetupJourneySelect = useCallback(
    async (journey: OnboardingSetupJourney) => {
      if (isStreaming) return;
      try {
        clearError();
        const baseContext = ensureSpaceSetupContext(onboardingContext, lang);
        const message = formatOnboardingSetupJourneySubmitMessage(
          journey,
          onboardingSetupJourneyMessageLabels,
        );
        const nextContext = applyOnboardingSetupJourneyToContext(
          baseContext,
          journey,
          message,
        );
        await sendOnboardingSetupJourneyMessage(message, nextContext);
      } catch (err) {
        console.error(
          '[AiLeftPanel] setup journey select sendMessage error:',
          err,
        );
      }
    },
    [
      clearError,
      isStreaming,
      lang,
      onboardingContext,
      onboardingSetupJourneyMessageLabels,
      sendOnboardingSetupJourneyMessage,
    ],
  );

  const onboardingActivationMessageLabels = useMemo(
    () => ({
      sandbox: t('onboardingActivationSetSandbox'),
      pilot: t('onboardingActivationSetPilot'),
      deployment: t('onboardingActivationSetDeployment'),
    }),
    [t],
  );

  const handleOnboardingActivationSelect = useCallback(
    async (method: OnboardingActivationMethod) => {
      if (isStreaming) return;
      try {
        clearError();
        const baseContext = ensureSpaceSetupContext(onboardingContext, lang);
        const message = formatOnboardingActivationSubmitMessage(
          method,
          onboardingActivationMessageLabels,
        );
        const nextContext = applyOnboardingActivationToContext(
          baseContext,
          method,
          message,
        );
        await sendOnboardingActivationMessage(message, nextContext);
      } catch (err) {
        console.error(
          '[AiLeftPanel] activation select sendMessage error:',
          err,
        );
      }
    },
    [
      clearError,
      isStreaming,
      lang,
      onboardingActivationMessageLabels,
      onboardingContext,
      sendOnboardingActivationMessage,
    ],
  );

  const sendOnboardingTransparencyMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
      saveOnboardingConversationContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingTransparencyMessageLabels = useMemo(
    () => ({
      levelPublic: t('onboardingTransparencyLevelPublic'),
      levelNetwork: t('onboardingTransparencyLevelNetwork'),
      levelOrganisation: t('onboardingTransparencyLevelOrganisation'),
      levelSpace: t('onboardingTransparencyLevelSpace'),
      summary: (discoverability: string, access: string) =>
        t('onboardingTransparencySetSummary', { discoverability, access }),
    }),
    [t],
  );

  const handleOnboardingTransparencyConfirm = useCallback(
    async (matrix: OnboardingTransparencyMatrix) => {
      if (isStreaming) return;
      try {
        clearError();
        const baseContext = ensureSpaceSetupContext(onboardingContext, lang);
        const message = formatOnboardingTransparencySubmitMessage(
          matrix,
          onboardingTransparencyMessageLabels,
        );
        const nextContext = applyOnboardingTransparencyToContext(
          baseContext,
          matrix,
          message,
        );
        await sendOnboardingTransparencyMessage(message, nextContext);
      } catch (err) {
        console.error(
          '[AiLeftPanel] transparency confirm sendMessage error:',
          err,
        );
      }
    },
    [
      clearError,
      isStreaming,
      lang,
      onboardingContext,
      onboardingTransparencyMessageLabels,
      sendOnboardingTransparencyMessage,
    ],
  );

  const sendOnboardingEntryMethodMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
      saveOnboardingConversationContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingEntryMethodMessageLabels = useMemo(
    () => ({
      openAccess: t('onboardingEntryMethodSetOpen'),
      inviteOnly: t('onboardingEntryMethodSetInvite'),
      tokenBased: t('onboardingEntryMethodSetToken'),
    }),
    [t],
  );

  const handleOnboardingEntryMethodConfirm = useCallback(
    async (method: OnboardingEntryMethod) => {
      if (isStreaming) return;
      try {
        clearError();
        const baseContext = ensureSpaceSetupContext(onboardingContext, lang);
        const message = formatOnboardingEntryMethodSubmitMessage(
          method,
          onboardingEntryMethodMessageLabels,
        );
        const nextContext = applyOnboardingEntryMethodToContext(
          baseContext,
          method,
          message,
        );
        await sendOnboardingEntryMethodMessage(message, nextContext);
      } catch (err) {
        console.error(
          '[AiLeftPanel] entry method confirm sendMessage error:',
          err,
        );
      }
    },
    [
      clearError,
      isStreaming,
      lang,
      onboardingContext,
      onboardingEntryMethodMessageLabels,
      sendOnboardingEntryMethodMessage,
    ],
  );

  const sendOnboardingVotingMethodMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
      saveOnboardingConversationContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingVotingMethodMessageLabels = useMemo(
    () => ({
      oneMemberOneVote: t('onboardingVotingMethodSetOneMemberOneVote'),
      oneVoiceOneVote: t('onboardingVotingMethodSetOneVoiceOneVote'),
      oneTokenOneVote: t('onboardingVotingMethodSetOneTokenOneVote'),
    }),
    [t],
  );

  const handleOnboardingVotingMethodSelect = useCallback(
    async (method: OnboardingVotingMethod) => {
      if (isStreaming) return;
      try {
        clearError();
        const baseContext = ensureSpaceSetupContext(onboardingContext, lang);
        const message = formatOnboardingVotingMethodSubmitMessage(
          method,
          onboardingVotingMethodMessageLabels,
        );
        const nextContext = applyOnboardingVotingMethodToContext(
          baseContext,
          method,
          message,
        );
        await sendOnboardingVotingMethodMessage(message, nextContext);
      } catch (err) {
        console.error(
          '[AiLeftPanel] voting method select sendMessage error:',
          err,
        );
      }
    },
    [
      clearError,
      isStreaming,
      lang,
      onboardingContext,
      onboardingVotingMethodMessageLabels,
      sendOnboardingVotingMethodMessage,
    ],
  );

  const isOnboardingSetup = isSpaceSetupContext(onboardingContext);
  const discoveryMode: OnboardingDiscoveryMode =
    onboardingContext?.discoveryMode ?? 'chat';
  const isVoiceInterview =
    isOnboardingSetup && discoveryMode === 'voice_interview';

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const text = extractAssistantTextFromMessage(
        messages[i] as ChatUIMessage,
      );
      if (text) return text;
    }
    return '';
  }, [messages]);

  const handleVoiceTranscriptSend = useCallback(
    async (text: string) => {
      if (blockSpaceAiForInteraction) return;
      const normalized = text.trim();
      if (!normalized || isStreaming) return;
      setInput('');
      setDraftAttachments([]);
      try {
        clearError();
        const nextContext = resolveSetupContextForUserMessage(
          normalized,
          onboardingContext,
          lang,
        );
        const options = await buildMessageOptions(nextContext);
        await sendMessage(
          { role: 'user', parts: [{ type: 'text', text: normalized }] },
          options,
        );
        if (nextContext && nextContext !== onboardingContext) {
          setOnboardingContext(nextContext);
          saveOnboardingConversationContext(nextContext);
        }
      } catch (err) {
        console.error('[AiLeftPanel] voice send failed:', err);
      }
    },
    [
      blockSpaceAiForInteraction,
      buildMessageOptions,
      clearError,
      isStreaming,
      lang,
      onboardingContext,
      sendMessage,
    ],
  );

  const recentTranscriptSummary = useMemo(
    () => buildRecentTranscriptSummaryFromChatMessages(messages),
    [messages],
  );

  const handleVoiceTranscriptTurn = useCallback(
    (turn: { role: 'user' | 'assistant'; text: string }) => {
      setMessages((prev) => {
        const next = appendVoiceTranscriptTurn(prev, turn);
        if (isOnboardingSetup) {
          saveOnboardingChatMessages(toStoredOnboardingChatMessages(next));
        }
        return next;
      });
    },
    [isOnboardingSetup, setMessages],
  );

  const voiceInterview = useOnboardingVoiceDiscovery({
    enabled: isVoiceInterview,
    isStreaming,
    lastAssistantText,
    locale: lang,
    activeSpaceSlug: spaceSlug,
    conversationContext: onboardingContext,
    recentTranscriptSummary,
    getAccessToken,
    onSendTranscript: handleVoiceTranscriptSend,
    onTranscriptTurn: handleVoiceTranscriptTurn,
  });

  const handleDiscoveryModeChange = useCallback(
    (mode: OnboardingDiscoveryMode) => {
      if (!isOnboardingSetup || mode === discoveryMode) return;
      if (mode === 'chat') {
        voiceInterview.stopListening();
        voiceInterview.stopSpeaking();
        if (messages.length) {
          saveOnboardingChatMessages(toStoredOnboardingChatMessages(messages));
        }
      }
      setOnboardingContext((prev) => {
        const base = ensureSpaceSetupContext(prev, lang);
        const next = { ...base, discoveryMode: mode };
        saveOnboardingConversationContext(next);
        return next;
      });
    },
    [
      discoveryMode,
      isOnboardingSetup,
      lang,
      messages,
      voiceInterview.stopListening,
      voiceInterview.stopSpeaking,
    ],
  );

  const handleTriggerClick = useCallback(() => {
    if (isAiOpen || overlayVisible) {
      handleOverlayClose();
      return;
    }
    if (isCompactHeader && rightOpen) {
      toggleRight();
    }
    showAiOverlay();
  }, [
    handleOverlayClose,
    isAiOpen,
    overlayVisible,
    isCompactHeader,
    rightOpen,
    toggleRight,
    showAiOverlay,
  ]);
  const shouldCloseFromTrigger = isAiOpen || overlayVisible;

  const triggerButton = (
    <button
      type="button"
      onClick={handleTriggerClick}
      className={MENU_TRIGGER_CANVAS_CLASS}
      aria-label={shouldCloseFromTrigger ? t('closePanel') : t('openPanel')}
    >
      <Menu className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
    </button>
  );
  const closeButton = shouldCloseFromTrigger ? (
    <button
      type="button"
      onClick={handleOverlayClose}
      className={MENU_CLOSE_BUTTON_CLASS}
      title={t('hidePanel')}
      aria-label={t('closePanel')}
    >
      <PanelLeftClose className="h-4 w-4" />
    </button>
  ) : undefined;

  if (!isAiOpen) {
    if (overlayVisible) {
      return (
        <>
          <SidebarHeader className="bg-background-2 p-0">
            <AiPanelHeader
              showCloseButton={false}
              leftSlot={triggerButton}
              rightSlot={closeButton}
            />
          </SidebarHeader>
          <SidebarContent className="bg-background-2">
            <SidebarGroup className="p-2 pt-4">
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {sectionNavItems.map((item) =>
                    renderSectionNavItem(item, 'expanded', 'overlay'),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {spaceSettingsItem ? (
              <SidebarGroup className="mt-auto p-2 pb-0">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-2">
                    {renderSectionNavItem(
                      spaceSettingsItem,
                      'expanded',
                      'settings-overlay',
                    )}
                  </SidebarMenu>
                  <div className="mt-2 h-px bg-border/60" aria-hidden />
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
            {recentSpaces.length > 0
              ? renderRecentSpacesSection('expanded', 'recent-overlay')
              : null}
          </SidebarContent>
        </>
      );
    }

    return (
      <>
        <SidebarHeader className="flex h-[var(--menu-top-height,70px)] min-w-0 flex-shrink-0 items-center justify-end border-b border-border bg-background-2 px-4 py-2">
          <div className="-translate-y-px flex h-8 w-8 shrink-0 items-center justify-end">
            {triggerButton}
          </div>
        </SidebarHeader>
        <SidebarContent className="relative overflow-visible bg-background-2">
          <SidebarGroup className="p-2 pt-4">
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {sectionNavItems.map((item) =>
                  renderSectionNavItem(item, 'collapsed', 'collapsed'),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {spaceSettingsItem ? (
            <SidebarGroup className="mt-auto p-2 pb-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {renderSectionNavItem(
                    spaceSettingsItem,
                    'collapsed',
                    'settings-collapsed',
                  )}
                </SidebarMenu>
                <div className="mt-2 h-px bg-border/60" aria-hidden />
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {recentSpaces.length > 0
            ? renderRecentSpacesSection('collapsed', 'recent-collapsed')
            : null}
        </SidebarContent>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <SidebarHeader className="bg-background-2 p-0">
          <AiPanelHeader
            showCloseButton={false}
            leftSlot={triggerButton}
            rightSlot={closeButton}
          />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('loading')}</div>
        </SidebarContent>
      </>
    );
  }

  if (blockSpaceAiForActivityAccess) {
    return (
      <>
        <SidebarHeader className="bg-background-2 p-0">
          <AiPanelHeader
            showCloseButton={false}
            leftSlot={triggerButton}
            rightSlot={closeButton}
          />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 items-center justify-center px-6">
          <SpaceAccessDenied
            userState={userSpaceState}
            spaceId={effectiveSpaceWeb3Id}
            spaceSlug={spaceSlug ?? undefined}
          />
        </SidebarContent>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SidebarHeader className="bg-background-2 p-0">
          <AiPanelHeader
            showCloseButton={false}
            leftSlot={triggerButton}
            rightSlot={closeButton}
          />
        </SidebarHeader>
        <SidebarContent className="flex flex-1 items-center justify-center px-6">
          <SpaceAccessDenied
            userState={userSpaceState}
            spaceId={effectiveSpaceWeb3Id}
            spaceSlug={spaceSlug ?? undefined}
          />
        </SidebarContent>
      </>
    );
  }

  return (
    <>
      <SidebarHeader className="bg-background-2 p-0">
        <AiPanelHeader
          showCloseButton={false}
          leftSlot={triggerButton}
          rightSlot={closeButton}
        />
      </SidebarHeader>
      <SidebarContent className="bg-background-2 min-h-0">
        {spaceSlug && blockSpaceAiForSubscription ? (
          <div className="mx-3 mt-3 shrink-0">
            <AiPanelSubscriptionBanner spaceSlug={spaceSlug} />
          </div>
        ) : null}
        {spaceSlug &&
        blockSpaceAiForMembership &&
        hasSpaceActivityAccess &&
        isAuthenticated &&
        !isUserSpaceStateLoading ? (
          <div className="mx-3 mt-3 shrink-0">
            <SpaceAccessDenied
              userState={userSpaceState}
              spaceId={effectiveSpaceWeb3Id}
              spaceSlug={spaceSlug}
              className="py-4"
            />
          </div>
        ) : null}
        {error && !blockSpaceAiForInteraction ? (
          <div
            role="alert"
            className="mx-3 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <div>{t('streamError')}</div>
            {error instanceof Error && error.message ? (
              <div className="mt-1 whitespace-pre-wrap break-words font-mono text-xs opacity-90">
                {error.message}
              </div>
            ) : null}
          </div>
        ) : null}
        {isCreateSpaceWithWalletFlowError ? (
          <div
            role="alert"
            className="mx-3 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <div>{t('streamError')}</div>
            {createSpaceWithWalletFlowErrors.length > 0 ? (
              <div className="mt-1 whitespace-pre-wrap break-words font-mono text-xs opacity-90">
                {createSpaceWithWalletFlowErrors
                  .map((item) =>
                    item instanceof Error ? item.message : String(item),
                  )
                  .join('\n')}
              </div>
            ) : null}
          </div>
        ) : null}
        {isCreateAgreementWithWalletFlowError ? (
          <div
            role="alert"
            className="mx-3 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <div>{t('streamError')}</div>
            {createAgreementWithWalletFlowErrors.length > 0 ? (
              <div className="mt-1 text-xs opacity-90">
                {t('walletAgreementError')}
              </div>
            ) : null}
          </div>
        ) : null}
        <AiPanelMessages
          messages={messages as ChatUIMessage[]}
          suggestionItems={suggestionItems}
          showInlineSuggestions={!hasUserMessage && !blockSpaceAiForInteraction}
          onSuggestionSelect={
            blockSpaceAiForInteraction ? undefined : handleSuggestionSelect
          }
          onActionReplySelect={
            blockSpaceAiForInteraction ? undefined : handleActionReplySelect
          }
          activeSpaceName={activeSpaceName}
          isStreaming={isStreaming}
          onboardingContext={onboardingContext}
          onOnboardingLocationConfirm={
            blockSpaceAiForSubscription
              ? undefined
              : handleOnboardingLocationConfirm
          }
          onOnboardingLocationSkip={
            blockSpaceAiForSubscription
              ? undefined
              : handleOnboardingLocationSkip
          }
          onOnboardingSetupJourneySelect={
            blockSpaceAiForSubscription
              ? undefined
              : handleOnboardingSetupJourneySelect
          }
          onOnboardingActivationSelect={
            blockSpaceAiForSubscription
              ? undefined
              : handleOnboardingActivationSelect
          }
          onOnboardingTransparencyConfirm={
            blockSpaceAiForSubscription
              ? undefined
              : handleOnboardingTransparencyConfirm
          }
          onOnboardingEntryMethodConfirm={
            blockSpaceAiForSubscription
              ? undefined
              : handleOnboardingEntryMethodConfirm
          }
          onOnboardingVotingMethodSelect={
            blockSpaceAiForSubscription
              ? undefined
              : handleOnboardingVotingMethodSelect
          }
        />
      </SidebarContent>
      <SidebarFooter className="bg-background-2 p-0">
        {isOnboardingSetup ? (
          <div className="flex justify-center border-t border-border/60 px-3 py-2">
            <OnboardingDiscoveryModeToggle
              mode={discoveryMode}
              disabled={blockSpaceAiForInteraction || isStreaming}
              onChange={handleDiscoveryModeChange}
            />
          </div>
        ) : null}
        {hasUserMessage && !blockSpaceAiForInteraction ? (
          <AiPanelSuggestions
            items={suggestionItems}
            onSelect={handleSuggestionSelect}
            variant="tags"
          />
        ) : null}
        {isVoiceInterview ? (
          <OnboardingVoiceInterviewBar
            phase={voiceInterview.phase}
            liveTranscript={voiceInterview.liveTranscript}
            voiceError={voiceInterview.voiceError}
            disabled={blockSpaceAiForInteraction || isStreaming}
            isConnecting={voiceInterview.isConnecting}
            isRealtimeConnected={voiceInterview.isRealtimeConnected}
            transport={voiceInterview.transport}
            realtimeFeatureEnabled={voiceInterview.realtimeFeatureEnabled}
            usingWebSpeechFallback={voiceInterview.usingWebSpeechFallback}
            onToggleListening={voiceInterview.toggleListening}
            onStopSpeaking={voiceInterview.stopSpeaking}
          />
        ) : (
          <AiPanelChatBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            draftAttachments={draftAttachments}
            onDraftAttachmentsChange={setDraftAttachments}
            onStop={handleStop}
            isStreaming={isStreaming}
            composerDisabled={blockSpaceAiForInteraction}
          />
        )}
      </SidebarFooter>
    </>
  );
}
