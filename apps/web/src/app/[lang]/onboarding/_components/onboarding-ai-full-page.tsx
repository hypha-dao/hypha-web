'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthentication } from '@hypha-platform/authentication';
import { useConfig } from 'wagmi';
import {
  AiPanelChatBar,
  AiPanelMessages,
  type AiPanelDraftAttachment,
} from '@hypha-platform/epics';
import {
  Category,
  SpaceFlags,
  useCreateSpaceOrchestrator,
  useJwt,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';

type OnboardingContext = {
  mode: 'onboarding_setup';
  source: 'onboarding_hero';
  firstName?: string;
  locale?: string;
  createdAt: string;
  setupPhase?: 'discover' | 'draft' | 'confirm' | 'execute' | 'verify';
  lastUserText?: string;
};

type OnboardingAiFullPageProps = {
  seedPrompt: string;
  seedAttachments: File[];
  context: OnboardingContext;
  onExit: () => void;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
};

async function fileToPart(
  file: File,
): Promise<{ type: 'file'; mediaType: string; url: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value === 'string') resolve(value);
      else reject(new Error('Could not read file data'));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
  return {
    type: 'file',
    mediaType: file.type || 'application/octet-stream',
    url: dataUrl,
  };
}

export function OnboardingAiFullPage({
  seedPrompt,
  seedAttachments,
  context,
  onExit,
}: OnboardingAiFullPageProps) {
  const t = useTranslations('OnboardingAdventure');
  const tCommon = useTranslations('Common');
  const { getAccessToken } = useAuthentication();
  const { jwt } = useJwt();
  const config = useConfig();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<
    AiPanelDraftAttachment[]
  >([]);
  const [onboardingContext, setOnboardingContext] =
    useState<OnboardingContext>(context);
  const seededRef = useRef(false);
  const walletCreateInFlightRef = useRef(false);
  const handledWalletPayloadKeyRef = useRef<string | null>(null);
  const navigatedHrefRef = useRef<string | null>(null);
  const createdSpaceRef = useRef<string | null>(null);

  const { createSpace: createSpaceWithWalletFlow, space: walletCreatedSpace } =
    useCreateSpaceOrchestrator({ authToken: jwt, config });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: async (): Promise<Record<string, string>> => {
          const token = (await getAccessToken?.()) ?? undefined;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: { conversationContext: onboardingContext },
      }),
    [getAccessToken, onboardingContext],
  );

  const { messages, sendMessage, stop, status, error, clearError } = useChat({
    transport,
    onError: (chatError) => {
      console.error('[OnboardingAiFullPage][useChat]', chatError);
    },
  });
  const isStreaming = status === 'streaming' || status === 'submitted';

  const buildMessageOptions = useCallback(
    async (contextOverride?: OnboardingContext) => {
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

  const applyOnboardingContextForUserText = useCallback(
    (text: string): OnboardingContext => {
      const normalized = text.trim();
      const isExplicitConfirmation = /^confirm\b/i.test(normalized);
      return {
        ...onboardingContext,
        lastUserText: normalized,
        setupPhase: isExplicitConfirmation
          ? 'confirm'
          : onboardingContext.setupPhase === 'discover'
          ? 'draft'
          : onboardingContext.setupPhase,
      };
    },
    [onboardingContext],
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
            ? await Promise.all(seedAttachments.map(fileToPart))
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
  ]);

  useEffect(() => {
    const createdSlug = [...messages]
      .reverse()
      .flatMap((message) => message.parts ?? [])
      .find((part) => {
        if (typeof part.type !== 'string' || !part.type.startsWith('tool-'))
          return false;
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
      `/${context.locale ?? 'en'}/dho/${slug}/agreements/space-configuration`,
    );
  }, [context.locale, messages, router]);

  useEffect(() => {
    const slug =
      typeof walletCreatedSpace?.slug === 'string'
        ? walletCreatedSpace.slug.trim()
        : '';
    if (!slug) return;
    if (createdSpaceRef.current === slug) return;
    createdSpaceRef.current = slug;
    router.push(
      `/${context.locale ?? 'en'}/dho/${slug}/agreements/space-configuration`,
    );
  }, [context.locale, router, walletCreatedSpace?.slug]);

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
    const payload = payloadResult?.part?.output?.create_payload;
    if (!payload?.title || !payload.description) return;
    if (payloadKey) handledWalletPayloadKeyRef.current = payloadKey;
    const normalizedTitle =
      typeof payload.title === 'string' ? payload.title.trim() : '';
    const normalizedDescription =
      typeof payload.description === 'string' ? payload.description.trim() : '';
    if (!normalizedTitle || !normalizedDescription) return;
    walletCreateInFlightRef.current = true;
    void (async () => {
      try {
        await createSpaceWithWalletFlow({
          title: normalizedTitle,
          description: normalizedDescription,
          slug: payload.slug ?? '',
          parentId:
            typeof payload.parent_id === 'number' ? payload.parent_id : null,
          flags: (Array.isArray(payload.flags)
            ? payload.flags
            : []) as SpaceFlags[],
          links: Array.isArray(payload.links) ? payload.links : [],
          categories: (Array.isArray(payload.categories)
            ? payload.categories
            : []) as Category[],
          logoUrl: payload.logo_url ?? '',
          leadImage: payload.lead_image_url ?? '',
          ...(payload.ecosystem_logo_light_url
            ? { ecosystemLogoUrlLight: payload.ecosystem_logo_light_url }
            : {}),
          ...(payload.ecosystem_logo_dark_url
            ? { ecosystemLogoUrlDark: payload.ecosystem_logo_dark_url }
            : {}),
        });
      } catch (walletFlowError) {
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
        ? applyOnboardingContextForUserText(text)
        : onboardingContext;
      if (text.trim()) {
        setOnboardingContext(nextContext);
      }
      const options = await buildMessageOptions(nextContext);
      const attachmentParts =
        attachments.length > 0
          ? await Promise.all(
              attachments.map((attachment) => fileToPart(attachment.file)),
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
        const nextContext = applyOnboardingContextForUserText(normalized);
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
      applyOnboardingContextForUserText,
      buildMessageOptions,
      clearError,
      isStreaming,
      sendMessage,
    ],
  );

  const suggestions = [
    t('aiHero.rotating.createSpace'),
    t('aiHero.rotating.governance'),
    t('aiHero.rotating.joinSpace'),
  ] as const;

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
            <Button
              onClick={onExit}
              className="h-10 rounded-lg border border-accent-8/45 bg-gradient-to-r from-accent-9/95 to-accent-10/95 px-4 text-accent-contrast shadow-[0_10px_24px_-14px_oklch(0.62_0.19_278)] ring-1 ring-accent-11/12 transition-all hover:brightness-105 hover:ring-accent-11/22"
            >
              {tCommon('back')}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/70">
            <AiPanelMessages
              messages={messages as ChatMessage[]}
              suggestions={suggestions}
              showSuggestions={!isStreaming}
              onSuggestionSelect={(text) => setInput(text)}
              isStreaming={isStreaming}
              onActionReplySelect={handleActionReplySelect}
            />
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
          </div>
          {error ? (
            <p className="mt-2 px-2 text-1 text-destructive">
              {String(error.message || error)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
