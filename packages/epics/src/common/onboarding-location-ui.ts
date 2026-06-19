'use client';

import type { SpaceLocationSource } from '@hypha-platform/core/client';

import {
  ONBOARDING_SETUP_MODE,
  type OnboardingConversationContext,
  type OnboardingSpaceLocation,
} from './ai-onboarding-context';
import type { SpaceLocationValue } from '../spaces/components/space-location-picker';

function parseEnableNetworkMap(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
}

export function getClientEnableNetworkMap(): boolean {
  return parseEnableNetworkMap(process.env.NEXT_PUBLIC_ENABLE_NETWORK_MAP);
}

type ChatUiMessage = {
  role: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
};

type OnboardingGuidanceOutput = {
  ok?: boolean;
  requires_location_picker?: boolean;
  next_field?: string | null;
};

export function shouldShowOnboardingLocationPicker({
  messages,
  onboardingContext,
  isStreaming,
  enableNetworkMap,
}: {
  messages: ChatUiMessage[];
  onboardingContext?: OnboardingConversationContext;
  isStreaming: boolean;
  enableNetworkMap: boolean;
}): boolean {
  if (!enableNetworkMap) return false;
  if (isStreaming) return false;
  if (onboardingContext?.mode !== ONBOARDING_SETUP_MODE) return false;
  if (onboardingContext.spaceLocation?.skipped) return false;
  if (
    onboardingContext.spaceLocation?.latitude != null &&
    onboardingContext.spaceLocation?.longitude != null
  ) {
    return false;
  }

  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const message = messages[messageIndex];
    if (!message || message.role !== 'assistant') continue;

    for (const part of message.parts ?? []) {
      if (part.type !== 'tool-onboarding_guidance') continue;
      if (part.state !== 'output-available') continue;

      const output = part.output as OnboardingGuidanceOutput | undefined;
      if (!output?.ok) continue;
      if (
        output.requires_location_picker === true ||
        output.next_field === 'space_location'
      ) {
        return true;
      }
    }
  }

  return false;
}

export function formatOnboardingLocationSubmitMessage(
  value: SpaceLocationValue,
): string {
  if (value.locationLabel?.trim()) {
    return `Location set: ${value.locationLabel.trim()}`;
  }
  if (value.latitude != null && value.longitude != null) {
    return `Location set: ${value.latitude}, ${value.longitude}`;
  }
  return 'Location set';
}

export function onboardingSpaceLocationFromPicker(
  value: SpaceLocationValue,
): OnboardingSpaceLocation {
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    locationLabel: value.locationLabel,
    locationSource: value.locationSource as SpaceLocationSource | null,
    skipped: false,
  };
}

export function skippedOnboardingSpaceLocation(): OnboardingSpaceLocation {
  return {
    latitude: null,
    longitude: null,
    locationLabel: null,
    locationSource: null,
    skipped: true,
  };
}

export function applyOnboardingLocationToContext(
  context: OnboardingConversationContext,
  location: OnboardingSpaceLocation,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    spaceLocation: location,
    lastUserText: userMessage,
    setupPhase:
      context.setupPhase === 'discover' ? 'draft' : context.setupPhase,
  };
}
