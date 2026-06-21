'use client';

type ChatUiMessage = {
  role: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
};

export type OnboardingGuidancePickerOutput = {
  ok?: boolean;
  next_field?: string | null;
  requires_setup_journey_picker?: boolean;
  requires_activation_picker?: boolean;
  requires_transparency_picker?: boolean;
  requires_entry_method_picker?: boolean;
  requires_location_picker?: boolean;
};

export function findLatestOnboardingGuidanceOutput(
  messages: ChatUiMessage[],
): OnboardingGuidancePickerOutput | null {
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

      const output = part.output as OnboardingGuidancePickerOutput | undefined;
      if (output?.ok) return output;
    }
  }

  return null;
}

export function shouldShowOnboardingGuidancePicker({
  messages,
  isStreaming,
  nextField,
  requiresFlag,
  alreadyAnswered = false,
}: {
  messages: ChatUiMessage[];
  isStreaming: boolean;
  nextField: string;
  requiresFlag?: keyof OnboardingGuidancePickerOutput;
  alreadyAnswered?: boolean;
}): boolean {
  if (isStreaming || alreadyAnswered) return false;

  const output = findLatestOnboardingGuidanceOutput(messages);
  if (!output?.ok) return false;
  if (requiresFlag && output[requiresFlag] === true) return true;
  return output.next_field === nextField;
}
