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
  requires_transparency_discoverability_picker?: boolean;
  requires_transparency_activity_picker?: boolean;
  transparency_picker_step?: 'discoverability' | 'activity' | null;
  requires_entry_method_picker?: boolean;
  requires_location_picker?: boolean;
  /** Already collected, so the next card can keep the same choice. */
  answered_activation_method?: string | null;
  answered_transparency_discoverability?: number | null;
};

function isOnboardingGuidancePart(part: {
  type: string;
  [key: string]: unknown;
}) {
  if (part.type === 'tool-onboarding_guidance') return true;
  return (
    part.type === 'dynamic-tool' && part.toolName === 'onboarding_guidance'
  );
}

function readGuidanceOutput(
  value: unknown,
): OnboardingGuidancePickerOutput | null {
  let output = value;
  if (typeof output === 'string') {
    try {
      output = JSON.parse(output) as unknown;
    } catch {
      return null;
    }
  }
  if (!output || typeof output !== 'object') return null;
  const row = output as OnboardingGuidancePickerOutput;
  return row.ok ? row : null;
}

function findGuidanceOutputOnMessage(
  message: ChatUiMessage,
): OnboardingGuidancePickerOutput | null {
  let found: OnboardingGuidancePickerOutput | null = null;
  for (const part of message.parts ?? []) {
    if (!isOnboardingGuidancePart(part)) continue;
    if (part.state !== 'output-available') continue;
    const output = readGuidanceOutput(part.output);
    if (output) found = output;
  }

  return found;
}

export function findLatestOnboardingGuidanceOutput(
  messages: ChatUiMessage[],
): OnboardingGuidancePickerOutput | null {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const message = messages[messageIndex];
    if (!message) continue;
    // A later user reply means the previous card has been answered.
    if (message.role === 'user') return null;
    if (message.role !== 'assistant') continue;
    const output = findGuidanceOutputOnMessage(message);
    if (output) return output;
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
  if (isStreaming || alreadyAnswered || messages.length === 0) return false;

  const output = findLatestOnboardingGuidanceOutput(messages);
  if (!output?.ok) return false;
  if (requiresFlag && output[requiresFlag] === true) return true;
  return output.next_field === nextField;
}
