'use client';

import type { SpaceLocationSource } from '@hypha-platform/core/client';

import {
  type OnboardingConversationContext,
  type OnboardingSpaceLocation,
} from './ai-onboarding-context';
import { shouldShowOnboardingGuidancePicker } from './onboarding-guidance-picker-ui';
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
  const locationAnswered =
    onboardingContext?.spaceLocation?.skipped === true ||
    (onboardingContext?.spaceLocation?.latitude != null &&
      onboardingContext?.spaceLocation?.longitude != null);
  return shouldShowOnboardingGuidancePicker({
    messages,
    isStreaming,
    nextField: 'space_location',
    requiresFlag: 'requires_location_picker',
    alreadyAnswered: locationAnswered,
  });
}

export type OnboardingLocationMessageLabels = {
  withLabel: (label: string) => string;
  withCoordinates: (latitude: number, longitude: number) => string;
  fallback: string;
};

export function formatOnboardingLocationSubmitMessage(
  value: SpaceLocationValue,
  labels: OnboardingLocationMessageLabels,
): string {
  if (value.locationLabel?.trim()) {
    return labels.withLabel(value.locationLabel.trim());
  }
  if (value.latitude != null && value.longitude != null) {
    return labels.withCoordinates(value.latitude, value.longitude);
  }
  return labels.fallback;
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
