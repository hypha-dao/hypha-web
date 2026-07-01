'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useConfig } from 'wagmi';
import {
  AiPanelChatBar,
  AiPanelMessages,
  OnboardingDiscoveryModeToggle,
  OnboardingVoiceInterviewBar,
  type AiPanelDraftAttachment,
  applyOnboardingContextForUserText,
  applyOnboardingLocationToContext,
  applyOnboardingActivationToContext,
  applyOnboardingSetupJourneyToContext,
  applyOnboardingDiscoverabilityToContext,
  applyOnboardingTransparencyToContext,
  applyOnboardingEntryMethodToContext,
  formatOnboardingLocationSubmitMessage,
  formatOnboardingActivationSubmitMessage,
  formatOnboardingSetupJourneySubmitMessage,
  getOnboardingSetupJourneySubmitLabels,
  formatOnboardingDiscoverabilitySubmitMessage,
  formatOnboardingTransparencySubmitMessage,
  formatOnboardingEntryMethodSubmitMessage,
  onboardingLocationFromCreatePayload,
  onboardingTransparencyFromCreatePayload,
  onboardingJoinMethodFromCreatePayload,
  extractOnboardingVisualAssetsFromMessages,
  mergeVisualAssetsIntoCreatePayload,
  preparePostRootOnboardingHandoff,
  syncEcosystemBlueprintInContext,
  onboardingSpaceLocationFromPicker,
  skippedOnboardingSpaceLocation,
  saveOnboardingConversationContext,
  handoffOnboardingToAiPanel,
  saveOnboardingChatMessages,
  appendVoiceTranscriptTurn,
  buildRecentTranscriptSummaryFromChatMessages,
  toStoredOnboardingChatMessages,
  convertFilesToParts,
  getPostOnboardingLandingPath,
  AI_PANEL_SETUP_SOURCE,
  recordMobilizedAiAgentsForOnboarding,
  useOnboardingVoiceDiscovery,
  type OnboardingDiscoveryMode,
  type OnboardingEntryMethod,
  type OnboardingActivationMethod,
  type OnboardingSetupJourney,
  type OnboardingConversationContext,
  type OnboardingTransparencyMatrix,
  type SpaceLocationValue,
  type StoredOnboardingChatMessage,
} from '@hypha-platform/epics';
import {
  Category,
  SpaceFlags,
  useCreateSpaceOrchestrator,
  useJwt,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { ChevronLeftIcon } from '@radix-ui/react-icons';

type OnboardingAiFullPageProps = {
  seedPrompt: string;
  seedAttachments: File[];
  context: OnboardingConversationContext;
  onExit: () => void;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
};

function extractAssistantText(message: ChatMessage | undefined): string {
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

export function OnboardingAiFullPage({
  seedPrompt,
  seedAttachments,
  context,
  onExit,
}: OnboardingAiFullPageProps) {
  const t = useTranslations('OnboardingAdventure');
  const tCommon = useTranslations('Common');
  const routeLocale = useLocale();
  const { getAccessToken } = useAuthentication();
  const { jwt } = useJwt();
  const config = useConfig();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<
    AiPanelDraftAttachment[]
  >([]);
  const [onboardingContext, setOnboardingContext] =
    useState<OnboardingConversationContext>(context);
  const seededRef = useRef(false);
  const walletCreateInFlightRef = useRef(false);
  const handledWalletPayloadKeyRef = useRef<string | null>(null);
  const navigatedHrefRef = useRef<string | null>(null);
  const createdSpaceRef = useRef<string | null>(null);

  useEffect(() => {
    const resolved = onboardingContext.locale ?? context.locale ?? routeLocale;
    if (onboardingContext.locale === resolved) return;
    setOnboardingContext((prev) => {
      const next = { ...prev, locale: resolved };
      saveOnboardingConversationContext(next);
      return next;
    });
  }, [context.locale, onboardingContext.locale, routeLocale]);

  const {
    createSpace: createSpaceWithWalletFlow,
    space: walletCreatedSpace,
    isPending: isWalletCreatePending,
    currentAction: walletCreateAction,
    isError: isWalletCreateError,
    errors: walletCreateErrors,
  } = useCreateSpaceOrchestrator({ authToken: jwt, config });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => {
          const token = (await getAccessToken?.()) ?? undefined;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
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
      console.error('[OnboardingAiFullPage][useChat]', chatError);
    },
  });
  const isStreaming = status === 'streaming' || status === 'submitted';

  const buildMessageOptions = useCallback(
    async (contextOverride?: OnboardingConversationContext) => {
      const token = (await getAccessToken?.()) ?? undefined;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      return {
        headers,
        body: { conversationContext: contextOverride ?? onboardingContext },
      };
    },
    [getAccessToken, onboardingContext],
  );

  const applyOnboardingContextForUserTextLocal = useCallback(
    (text: string): OnboardingConversationContext =>
      applyOnboardingContextForUserText(onboardingContext, text),
    [onboardingContext],
  );

  const sendOnboardingLocationMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const sendOnboardingActivationMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingLocationMessageLabels = useMemo(
    () => ({
      withLabel: (label: string) =>
        t('aiHero.onboardingLocationSetWithLabel', { label }),
      withCoordinates: (latitude: number, longitude: number) =>
        t('aiHero.onboardingLocationSetWithCoordinates', {
          latitude,
          longitude,
        }),
      fallback: t('aiHero.onboardingLocationSetFallback'),
    }),
    [t],
  );

  const handleOnboardingLocationConfirm = useCallback(
    async (value: SpaceLocationValue) => {
      if (isStreaming) return;
      try {
        clearError();
        const message = formatOnboardingLocationSubmitMessage(
          value,
          onboardingLocationMessageLabels,
        );
        const nextContext = applyOnboardingLocationToContext(
          onboardingContext,
          onboardingSpaceLocationFromPicker(value),
          message,
        );
        await sendOnboardingLocationMessage(message, nextContext);
      } catch (sendError) {
        console.error(
          '[OnboardingAiFullPage] location confirm send failed:',
          sendError,
        );
      }
    },
    [
      clearError,
      isStreaming,
      onboardingContext,
      onboardingLocationMessageLabels,
      sendOnboardingLocationMessage,
    ],
  );

  const handleOnboardingLocationSkip = useCallback(async () => {
    if (isStreaming) return;
    try {
      clearError();
      const message = t('aiHero.skipLocationMessage');
      const nextContext = applyOnboardingLocationToContext(
        onboardingContext,
        skippedOnboardingSpaceLocation(),
        message,
      );
      await sendOnboardingLocationMessage(message, nextContext);
    } catch (sendError) {
      console.error(
        '[OnboardingAiFullPage] location skip send failed:',
        sendError,
      );
    }
  }, [
    clearError,
    isStreaming,
    onboardingContext,
    sendOnboardingLocationMessage,
    t,
  ]);

  const sendOnboardingSetupJourneyMessage = useCallback(
    async (text: string, nextContext: OnboardingConversationContext) => {
      const options = await buildMessageOptions(nextContext);
      await sendMessage(
        { role: 'user', parts: [{ type: 'text', text }] },
        options,
      );
      setOnboardingContext(nextContext);
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingSetupJourneyMessageLabels = useMemo(
    () => getOnboardingSetupJourneySubmitLabels(routeLocale),
    [routeLocale],
  );

  const handleOnboardingSetupJourneySelect = useCallback(
    async (journey: OnboardingSetupJourney, submitLabel: string) => {
      if (isStreaming) return;
      try {
        clearError();
        const message =
          submitLabel.trim() ||
          formatOnboardingSetupJourneySubmitMessage(
            journey,
            onboardingSetupJourneyMessageLabels,
          );
        const nextContext = applyOnboardingSetupJourneyToContext(
          onboardingContext,
          journey,
          message,
        );
        await sendOnboardingSetupJourneyMessage(message, nextContext);
      } catch (sendError) {
        console.error(
          '[OnboardingAiFullPage] setup journey select send failed:',
          sendError,
        );
      }
    },
    [
      clearError,
      isStreaming,
      onboardingContext,
      onboardingSetupJourneyMessageLabels,
      sendOnboardingSetupJourneyMessage,
    ],
  );

  const onboardingActivationMessageLabels = useMemo(
    () => ({
      sandbox: t('aiHero.onboardingActivationSetSandbox'),
      pilot: t('aiHero.onboardingActivationSetPilot'),
      deployment: t('aiHero.onboardingActivationSetDeployment'),
    }),
    [t],
  );

  const handleOnboardingActivationSelect = useCallback(
    async (method: OnboardingActivationMethod) => {
      if (isStreaming) return;
      try {
        clearError();
        const message = formatOnboardingActivationSubmitMessage(
          method,
          onboardingActivationMessageLabels,
        );
        const nextContext = applyOnboardingActivationToContext(
          onboardingContext,
          method,
          message,
        );
        await sendOnboardingActivationMessage(message, nextContext);
      } catch (sendError) {
        console.error(
          '[OnboardingAiFullPage] activation select send failed:',
          sendError,
        );
      }
    },
    [
      clearError,
      isStreaming,
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
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingTransparencyMessageLabels = useMemo(
    () => ({
      levelPublic: t('aiHero.onboardingTransparencyLevelPublic'),
      levelNetwork: t('aiHero.onboardingTransparencyLevelNetwork'),
      levelOrganisation: t('aiHero.onboardingTransparencyLevelOrganisation'),
      levelSpace: t('aiHero.onboardingTransparencyLevelSpace'),
      summary: (discoverability: string, access: string) =>
        t('aiHero.onboardingTransparencySetSummary', {
          discoverability,
          access,
        }),
      discoverabilitySummary: (discoverability: string) =>
        t('aiHero.onboardingTransparencyDiscoverabilitySetSummary', {
          discoverability,
        }),
    }),
    [t],
  );

  const handleOnboardingDiscoverabilityConfirm = useCallback(
    async (level: OnboardingTransparencyMatrix['discoverability']) => {
      if (isStreaming) return;
      try {
        clearError();
        const message = formatOnboardingDiscoverabilitySubmitMessage(
          level,
          onboardingTransparencyMessageLabels,
        );
        const nextContext = applyOnboardingDiscoverabilityToContext(
          onboardingContext,
          level,
          message,
        );
        await sendOnboardingTransparencyMessage(message, nextContext);
      } catch (sendError) {
        console.error(
          '[OnboardingAiFullPage] discoverability confirm send failed:',
          sendError,
        );
      }
    },
    [
      clearError,
      isStreaming,
      onboardingContext,
      onboardingTransparencyMessageLabels,
      sendOnboardingTransparencyMessage,
    ],
  );

  const handleOnboardingTransparencyConfirm = useCallback(
    async (matrix: OnboardingTransparencyMatrix) => {
      if (isStreaming) return;
      try {
        clearError();
        const message = formatOnboardingTransparencySubmitMessage(
          matrix,
          onboardingTransparencyMessageLabels,
        );
        const nextContext = applyOnboardingTransparencyToContext(
          onboardingContext,
          matrix,
          message,
        );
        await sendOnboardingTransparencyMessage(message, nextContext);
      } catch (sendError) {
        console.error(
          '[OnboardingAiFullPage] transparency confirm send failed:',
          sendError,
        );
      }
    },
    [
      clearError,
      isStreaming,
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
    },
    [buildMessageOptions, sendMessage],
  );

  const onboardingEntryMethodMessageLabels = useMemo(
    () => ({
      openAccess: t('aiHero.onboardingEntryMethodSetOpen'),
      inviteOnly: t('aiHero.onboardingEntryMethodSetInvite'),
      tokenBased: t('aiHero.onboardingEntryMethodSetToken'),
    }),
    [t],
  );

  const handleOnboardingEntryMethodConfirm = useCallback(
    async (method: OnboardingEntryMethod) => {
      if (isStreaming) return;
      try {
        clearError();
        const message = formatOnboardingEntryMethodSubmitMessage(
          method,
          onboardingEntryMethodMessageLabels,
        );
        const nextContext = applyOnboardingEntryMethodToContext(
          onboardingContext,
          method,
          message,
        );
        await sendOnboardingEntryMethodMessage(message, nextContext);
      } catch (sendError) {
        console.error(
          '[OnboardingAiFullPage] entry method confirm send failed:',
          sendError,
        );
      }
    },
    [
      clearError,
      isStreaming,
      onboardingContext,
      onboardingEntryMethodMessageLabels,
      sendOnboardingEntryMethodMessage,
    ],
  );

  useEffect(() => {
    if (seededRef.current) return;
    if (isStreaming) return;
    if (!seedPrompt.trim() && seedAttachments.length === 0) return;
    seededRef.current = true;
    void (async () => {
      try {
        clearError();
        const options = await buildMessageOptions();
        const attachmentParts =
          seedAttachments.length > 0
            ? await convertFilesToParts(seedAttachments, {
                authorizationToken: jwt ?? undefined,
              })
            : [];
        const textParts = seedPrompt.trim()
          ? [{ type: 'text' as const, text: seedPrompt.trim() }]
          : [];
        await sendMessage(
          { role: 'user', parts: [...textParts, ...attachmentParts] },
          options,
        );
      } catch (seedError) {
        console.error('[OnboardingAiFullPage] seed send failed:', seedError);
      }
    })();
  }, [
    buildMessageOptions,
    clearError,
    isStreaming,
    seedAttachments,
    seedPrompt,
    sendMessage,
    jwt,
  ]);

  useEffect(() => {
    const createdSlug = [...messages]
      .reverse()
      .flatMap((message) => message.parts ?? [])
      .find((part) => {
        if (part.type !== 'tool-create_space_from_onboarding') return false;
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
      }) as { output?: { space?: { slug?: string } } } | undefined;

    const slug = createdSlug?.output?.space?.slug?.trim();
    if (!slug) return;
    if (createdSpaceRef.current === slug) return;
    createdSpaceRef.current = slug;
    router.push(
      getPostOnboardingLandingPath(
        context.locale ?? 'en',
        slug,
        onboardingContext.setupJourney,
      ),
    );
  }, [context.locale, messages, onboardingContext.setupJourney, router]);

  useEffect(() => {
    const slug =
      typeof walletCreatedSpace?.slug === 'string'
        ? walletCreatedSpace.slug.trim()
        : '';
    if (!slug) return;
    if (createdSpaceRef.current === slug) return;
    createdSpaceRef.current = slug;

    const handoff = preparePostRootOnboardingHandoff(
      { ...onboardingContext, source: AI_PANEL_SETUP_SOURCE },
      messages,
      slug,
    );

    handoffOnboardingToAiPanel({
      messages: messages as StoredOnboardingChatMessage[],
      context: handoff.context,
      continuationPrompt: handoff.continuationPrompt,
    });

    router.push(
      getPostOnboardingLandingPath(
        context.locale ?? 'en',
        slug,
        onboardingContext.setupJourney,
      ),
    );
  }, [
    context.locale,
    messages,
    onboardingContext,
    router,
    walletCreatedSpace?.slug,
  ]);

  useEffect(() => {
    const navOutput = [...messages]
      .reverse()
      .flatMap((message) =>
        (message.parts ?? []).map((part, index) => ({
          messageId: message.id,
          index,
          part,
        })),
      )
      .find(({ part }) => {
        if (part.type !== 'tool-mcp_navigation') return false;
        const toolPart = part as {
          state?: string;
          output?: {
            ok?: boolean;
            navigation?: { href?: string; open_in_new_tab?: boolean };
          };
        };
        return (
          toolPart.state === 'output-available' &&
          toolPart.output?.ok === true &&
          typeof toolPart.output?.navigation?.href === 'string'
        );
      });
    const navPart = navOutput?.part as
      | {
          output?: {
            navigation?: { href?: string; open_in_new_tab?: boolean };
          };
        }
      | undefined;
    const href = navPart?.output?.navigation?.href?.trim();
    if (!href) return;
    const navKey = `${navOutput?.messageId ?? 'm'}:${
      navOutput?.index ?? 0
    }:${href}`;
    if (navigatedHrefRef.current === navKey) return;
    navigatedHrefRef.current = navKey;

    const openInNewTab = navPart?.output?.navigation?.open_in_new_tab === true;
    const isExternal = /^https?:\/\//i.test(href);
    if (openInNewTab || isExternal) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(href);
  }, [messages, router]);

  useEffect(() => {
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
    const synced = syncEcosystemBlueprintInContext(onboardingContext, messages);
    if (!synced) return;
    setOnboardingContext(synced);
    saveOnboardingConversationContext(synced);
  }, [messages, onboardingContext]);

  useEffect(() => {
    if (walletCreateInFlightRef.current) return;
    const payloadResult = [...messages]
      .reverse()
      .flatMap((message) =>
        (message.parts ?? []).map((part, index) => ({
          messageId: message.id,
          index,
          part,
        })),
      )
      .find(({ part }) => {
        if (typeof part.type !== 'string' || !part.type.startsWith('tool-'))
          return false;
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

    const payloadKey = payloadResult
      ? `${payloadResult.messageId ?? 'm'}:${payloadResult.index ?? 0}`
      : null;
    if (payloadKey && handledWalletPayloadKeyRef.current === payloadKey) return;
    const payload = mergeVisualAssetsIntoCreatePayload(
      (payloadResult?.part?.output?.create_payload ?? {}) as Record<
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
        '[OnboardingAiFullPage] Skipping wallet create — logo and banner URLs are required.',
        { title: payload.title },
      );
      return;
    }
    const executeContext: OnboardingConversationContext = {
      ...onboardingContext,
      setupPhase: 'execute',
      lastUserText: onboardingContext.lastUserText,
    };
    setOnboardingContext(executeContext);
    walletCreateInFlightRef.current = true;
    void (async () => {
      try {
        await createSpaceWithWalletFlow({
          title: normalizedTitle,
          description: normalizedDescription,
          slug: typeof payload.slug === 'string' ? payload.slug : '',
          parentId:
            typeof payload.parent_id === 'number' ? payload.parent_id : null,
          flags: (Array.isArray(payload.flags)
            ? payload.flags
            : []) as SpaceFlags[],
          links: Array.isArray(payload.links)
            ? (payload.links as string[])
            : [],
          categories: (Array.isArray(payload.categories)
            ? payload.categories
            : []) as Category[],
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
        handledWalletPayloadKeyRef.current = null;
        console.error(
          '[OnboardingAiFullPage] wallet creation failed:',
          walletFlowError,
        );
      } finally {
        walletCreateInFlightRef.current = false;
      }
    })();
  }, [createSpaceWithWalletFlow, messages]);

  const handleSend = useCallback(async () => {
    if ((!input.trim() && draftAttachments.length === 0) || isStreaming) return;
    const text = input;
    const attachments = [...draftAttachments];
    setInput('');
    setDraftAttachments([]);
    try {
      clearError();
      const nextContext = text.trim()
        ? applyOnboardingContextForUserTextLocal(text)
        : onboardingContext;
      if (text.trim()) {
        recordMobilizedAiAgentsForOnboarding(text.trim());
        setOnboardingContext(nextContext);
      }
      const options = await buildMessageOptions(nextContext);
      const attachmentParts =
        attachments.length > 0
          ? await convertFilesToParts(
              attachments.map((attachment) => attachment.file),
              { authorizationToken: jwt ?? undefined },
            )
          : [];
      const textParts = text.trim() ? [{ type: 'text' as const, text }] : [];
      await sendMessage(
        { role: 'user', parts: [...textParts, ...attachmentParts] },
        options,
      );
      for (const att of attachments) {
        if (att.previewUrl.startsWith('blob:'))
          URL.revokeObjectURL(att.previewUrl);
      }
    } catch (sendError) {
      console.error('[OnboardingAiFullPage] send failed:', sendError);
      setInput(text);
      setDraftAttachments(attachments);
    }
  }, [
    buildMessageOptions,
    clearError,
    draftAttachments,
    input,
    isStreaming,
    jwt,
    sendMessage,
  ]);

  const handleActionReplySelect = useCallback(
    async (text: string) => {
      const normalized = text.trim();
      if (!normalized || isStreaming) return;
      setInput('');
      setDraftAttachments([]);
      try {
        clearError();
        const nextContext = applyOnboardingContextForUserTextLocal(normalized);
        setOnboardingContext(nextContext);
        const options = await buildMessageOptions(nextContext);
        await sendMessage(
          { role: 'user', parts: [{ type: 'text', text: normalized }] },
          options,
        );
      } catch (sendError) {
        console.error(
          '[OnboardingAiFullPage] quick reply send failed:',
          sendError,
        );
        setInput(text);
      }
    },
    [
      applyOnboardingContextForUserTextLocal,
      buildMessageOptions,
      clearError,
      isStreaming,
      sendMessage,
    ],
  );

  const suggestionItems = useMemo(
    () =>
      (
        [
          { id: 'createSpace', key: 'createSpace' },
          { id: 'governance', key: 'governance' },
          { id: 'joinSpace', key: 'joinSpace' },
        ] as const
      ).map(({ id, key }) => {
        const prompt = t(`aiHero.rotating.${key}`);
        return { id, prompt, tagLabel: prompt };
      }),
    [t],
  );
  const hasUserMessage = messages.some((message) => message.role === 'user');
  const discoveryMode: OnboardingDiscoveryMode =
    onboardingContext.discoveryMode ?? 'chat';
  const isVoiceInterview = discoveryMode === 'voice_interview';

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const text = extractAssistantText(messages[i] as ChatMessage);
      if (text) return text;
    }
    return '';
  }, [messages]);

  const handleVoiceTranscriptSend = useCallback(
    async (text: string) => {
      const normalized = text.trim();
      if (!normalized || isStreaming) return 'skipped' as const;
      setInput('');
      setDraftAttachments([]);
      try {
        clearError();
        const nextContext = applyOnboardingContextForUserTextLocal(normalized);
        recordMobilizedAiAgentsForOnboarding(normalized);
        setOnboardingContext(nextContext);
        const options = await buildMessageOptions(nextContext);
        await sendMessage(
          { role: 'user', parts: [{ type: 'text', text: normalized }] },
          options,
        );
        return 'sent' as const;
      } catch (sendError) {
        console.error('[OnboardingAiFullPage] voice send failed:', sendError);
        return 'failed' as const;
      }
    },
    [
      applyOnboardingContextForUserTextLocal,
      buildMessageOptions,
      clearError,
      isStreaming,
      sendMessage,
    ],
  );

  const recentTranscriptSummary = useMemo(
    () => buildRecentTranscriptSummaryFromChatMessages(messages),
    [messages],
  );

  const handleVoiceTranscriptTurn = useCallback(
    (turn: { role: 'user' | 'assistant'; text: string }) => {
      if (isStreaming) return;
      setMessages((prev) => {
        const next = appendVoiceTranscriptTurn(prev, turn);
        saveOnboardingChatMessages(toStoredOnboardingChatMessages(next));
        return next;
      });
    },
    [isStreaming, setMessages],
  );

  const voiceLocale = onboardingContext.locale ?? context.locale ?? routeLocale;

  const voiceInterview = useOnboardingVoiceDiscovery({
    enabled: isVoiceInterview,
    isStreaming,
    lastAssistantText,
    locale: voiceLocale,
    conversationContext: onboardingContext,
    recentTranscriptSummary,
    getAccessToken,
    onStopChat: stop,
    onSendTranscript: handleVoiceTranscriptSend,
    onTranscriptTurn: handleVoiceTranscriptTurn,
  });

  const handleDiscoveryModeChange = useCallback(
    (mode: OnboardingDiscoveryMode) => {
      if (mode === discoveryMode) return;
      if (mode === 'chat') {
        voiceInterview.stopListening();
        voiceInterview.stopSpeaking();
        if (messages.length) {
          saveOnboardingChatMessages(toStoredOnboardingChatMessages(messages));
        }
      }
      setOnboardingContext((prev) => {
        const next = { ...prev, discoveryMode: mode };
        saveOnboardingConversationContext(next);
        return next;
      });
    },
    [discoveryMode, messages, voiceInterview],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8 lg:px-12">
      <div className="relative h-[calc(100dvh-5rem)] max-h-[calc(100dvh-5rem)] overflow-hidden rounded-[2rem] border border-border/60 bg-background/85 p-4 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.75)] md:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,oklch(0.7_0.12_255_/_0.2),transparent_45%),radial-gradient(circle_at_80%_85%,oklch(0.7_0.14_330_/_0.14),transparent_42%)]"
        />
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          <div className="mb-4 flex items-center justify-between gap-3 px-2 md:px-4">
            <div>
              <p className="text-1 text-muted-foreground">
                {t('aiHero.flow.badge')}
              </p>
              <h2 className="text-7 font-semibold tracking-tight text-foreground">
                {t('aiHero.title')}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                colorVariant="neutral"
                onClick={onExit}
                className="text-neutral-10 px-0 md:px-3"
              >
                <ChevronLeftIcon className="size-4" />
                {tCommon('back')}
              </Button>
              <OnboardingDiscoveryModeToggle
                mode={discoveryMode}
                disabled={isStreaming}
                onChange={handleDiscoveryModeChange}
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/70">
            <AiPanelMessages
              messages={messages as ChatMessage[]}
              suggestionItems={suggestionItems}
              showInlineSuggestions={!isStreaming && !hasUserMessage}
              onSuggestionSelect={(text) => setInput(text)}
              isStreaming={isStreaming}
              onActionReplySelect={handleActionReplySelect}
              onboardingContext={onboardingContext}
              onOnboardingLocationConfirm={handleOnboardingLocationConfirm}
              onOnboardingLocationSkip={handleOnboardingLocationSkip}
              onOnboardingSetupJourneySelect={
                handleOnboardingSetupJourneySelect
              }
              onOnboardingActivationSelect={handleOnboardingActivationSelect}
              onOnboardingTransparencyConfirm={
                handleOnboardingTransparencyConfirm
              }
              onOnboardingDiscoverabilityConfirm={
                handleOnboardingDiscoverabilityConfirm
              }
              onOnboardingEntryMethodConfirm={
                handleOnboardingEntryMethodConfirm
              }
            />
            {isVoiceInterview ? (
              <OnboardingVoiceInterviewBar
                phase={voiceInterview.phase}
                liveTranscript={voiceInterview.liveTranscript}
                voiceError={voiceInterview.voiceError}
                disabled={isStreaming}
                isConnecting={voiceInterview.isConnecting}
                isRealtimeConnected={voiceInterview.isRealtimeConnected}
                transport={voiceInterview.transport}
                realtimeFeatureEnabled={voiceInterview.realtimeFeatureEnabled}
                usingWebSpeechFallback={voiceInterview.usingWebSpeechFallback}
                onToggleListening={voiceInterview.toggleListening}
              />
            ) : (
              <AiPanelChatBar
                value={input}
                onChange={setInput}
                onSend={handleSend}
                onStop={() => void stop()}
                isStreaming={isStreaming}
                draftAttachments={draftAttachments}
                onDraftAttachmentsChange={setDraftAttachments}
                placeholder={t('aiHero.placeholder')}
              />
            )}
          </div>
          {error ? (
            <p className="mt-2 px-2 text-1 text-destructive">
              {String(error.message || error)}
            </p>
          ) : null}
          {isWalletCreatePending && walletCreateAction ? (
            <p className="mt-2 px-2 text-1 text-muted-foreground">
              {walletCreateAction}
            </p>
          ) : null}
          {isWalletCreateError && walletCreateErrors.length > 0 ? (
            <p className="mt-2 px-2 text-1 text-destructive">
              {String(walletCreateErrors[0]?.message ?? walletCreateErrors[0])}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
