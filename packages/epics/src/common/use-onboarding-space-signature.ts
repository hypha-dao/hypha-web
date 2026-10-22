'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from 'wagmi';
import {
  useCreateSpaceOrchestrator,
  useJwt,
  type Category,
  type SpaceFlags,
} from '@hypha-platform/core/client';

import { getPostOnboardingLandingPath } from './ai-onboarding-context';
import {
  isOnboardingWalletHandoffPayloadHandled,
  isOnboardingWalletHandoffSlugComplete,
  markOnboardingWalletHandoffPayloadHandled,
  markOnboardingWalletHandoffSlugComplete,
  markOnboardingWalletSessionActive,
} from './onboarding-wallet-handoff';
import {
  onboardingJoinMethodFromCreatePayload,
  onboardingLocationFromCreatePayload,
  onboardingTransparencyFromCreatePayload,
} from './onboarding-create-payload';
import { mergeVisualAssetsIntoCreatePayload } from './onboarding-visual-assets';

type SignatureMessage = {
  id: string;
  parts?: ReadonlyArray<{
    type?: string;
    state?: string;
    output?: unknown;
  }>;
};

type CreatePayload = {
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

function walletCreateFromMessages(messages: readonly SignatureMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const parts = message.parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (part?.type !== 'tool-create_space_from_onboarding') continue;
      if (part.state !== 'output-available') continue;
      const output = part.output as
        | {
            ok?: boolean;
            requires_wallet_signature?: boolean;
            create_payload?: CreatePayload;
          }
        | undefined;
      if (
        output?.ok !== true ||
        output.requires_wallet_signature !== true ||
        !output.create_payload
      ) {
        continue;
      }
      return {
        key: `${message.id}:${partIndex}`,
        payload: output.create_payload,
      };
    }
  }
  return null;
}

/** Opens the wallet signature when space creation is ready, including on the member home. */
export function useOnboardingSpaceSignature(
  messages: readonly SignatureMessage[],
  lang: string,
) {
  const router = useRouter();
  const config = useConfig();
  const { jwt } = useJwt();
  const { createSpace, reset } = useCreateSpaceOrchestrator({
    authToken: jwt,
    config,
  });
  const inFlight = useRef(false);
  const handledKey = useRef<string | null>(null);
  const failedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!jwt || inFlight.current) return;
    const found = walletCreateFromMessages(messages);
    if (!found) return;
    if (handledKey.current === found.key || failedKey.current === found.key) {
      return;
    }
    if (isOnboardingWalletHandoffPayloadHandled(found.key)) {
      handledKey.current = found.key;
      return;
    }

    const payload = mergeVisualAssetsIntoCreatePayload(
      found.payload as Record<string, unknown>,
      messages as unknown as Parameters<
        typeof mergeVisualAssetsIntoCreatePayload
      >[1],
    ) as CreatePayload;
    const title = payload.title?.trim() ?? '';
    const description = payload.description?.trim() ?? '';
    const slug = payload.slug?.trim() ?? '';
    const logoUrl = payload.logo_url?.trim() ?? '';
    const leadImage = payload.lead_image_url?.trim() ?? '';
    if (!title || !description || !logoUrl || !leadImage) return;
    if (slug && isOnboardingWalletHandoffSlugComplete(slug)) {
      handledKey.current = found.key;
      markOnboardingWalletHandoffPayloadHandled(found.key);
      return;
    }

    inFlight.current = true;
    void (async () => {
      try {
        await createSpace({
          title,
          description,
          slug,
          parentId:
            typeof payload.parent_id === 'number' ? payload.parent_id : null,
          flags: Array.isArray(payload.flags)
            ? (payload.flags as SpaceFlags[])
            : [],
          links: Array.isArray(payload.links) ? payload.links : [],
          categories: Array.isArray(payload.categories)
            ? (payload.categories as Category[])
            : [],
          logoUrl,
          leadImage,
          ...(typeof payload.ecosystem_logo_light_url === 'string'
            ? { ecosystemLogoUrlLight: payload.ecosystem_logo_light_url }
            : {}),
          ...(typeof payload.ecosystem_logo_dark_url === 'string'
            ? { ecosystemLogoUrlDark: payload.ecosystem_logo_dark_url }
            : {}),
          ...onboardingLocationFromCreatePayload(
            payload as Record<string, unknown>,
          ),
          ...onboardingTransparencyFromCreatePayload(
            payload as Record<string, unknown>,
          ),
          ...onboardingJoinMethodFromCreatePayload(
            payload as Record<string, unknown>,
          ),
        });
        handledKey.current = found.key;
        markOnboardingWalletHandoffPayloadHandled(found.key);
        if (slug) {
          markOnboardingWalletHandoffSlugComplete(slug);
          markOnboardingWalletSessionActive();
          router.push(getPostOnboardingLandingPath(lang, slug));
        }
        reset();
      } catch (error) {
        failedKey.current = found.key;
        console.error(
          '[useOnboardingSpaceSignature] wallet space creation failed:',
          error,
        );
      } finally {
        inFlight.current = false;
      }
    })();
  }, [createSpace, jwt, lang, messages, reset, router]);
}
