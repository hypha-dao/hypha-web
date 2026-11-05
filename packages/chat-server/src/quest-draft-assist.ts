import 'server-only';

import { generateText, stepCountIs, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  QUEST_STEWARD_STEPS,
  selectSpecialistForQuestion,
  specialistById,
  type QuestStewardStep,
} from '@hypha-platform/core/client';
import { getHyphaChatModel } from './stream-chat';

const draftPatchSchema = z.object({
  name: z.string().trim().max(160).optional(),
  goal: z.string().trim().max(4000).optional(),
  scopeIn: z.array(z.string().trim().min(1).max(400)).max(25).optional(),
  scopeOut: z.array(z.string().trim().min(1).max(400)).max(25).optional(),
  successCriteriaBullets: z
    .array(z.string().trim().min(1).max(400))
    .max(20)
    .optional(),
  targetDate: z.string().trim().max(64).optional(),
  leadName: z.string().trim().max(120).optional(),
  rewards: z
    .array(
      z.object({
        amount: z.string().trim().min(1).max(40),
        token: z.string().trim().min(1).max(24),
      }),
    )
    .max(12)
    .optional(),
  milestones: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        dueDate: z.string().trim().max(64).optional(),
        description: z.string().trim().max(1000).optional(),
        ownerName: z.string().trim().max(120).optional(),
      }),
    )
    .max(20)
    .optional(),
  members: z
    .array(
      z.object({
        memberName: z.string().trim().min(1).max(120),
        roleLabel: z.string().trim().max(80).optional(),
        responsibilities: z
          .array(z.string().trim().min(1).max(300))
          .max(15)
          .optional(),
      }),
    )
    .max(30)
    .optional(),
});

export type QuestDraftAssistPatch = z.infer<typeof draftPatchSchema>;

export const questDraftAssistRequestSchema = z.object({
  message: z.string().trim().min(1).max(6000),
  currentStep: z.enum(QUEST_STEWARD_STEPS).optional(),
  spaceTitle: z.string().trim().max(200).optional(),
  draft: z
    .object({
      name: z.string().optional(),
      goal: z.string().optional(),
      scopeIn: z.array(z.string()).optional(),
      scopeOut: z.array(z.string()).optional(),
      successCriteria: z.string().optional(),
      targetDate: z.string().nullable().optional(),
      leadName: z.string().optional(),
      rewards: z
        .array(z.object({ amount: z.string(), token: z.string() }))
        .optional(),
      milestones: z
        .array(
          z.object({
            name: z.string(),
            dueDate: z.string().nullable().optional(),
            description: z.string().optional(),
            ownerName: z.string().nullable().optional(),
          }),
        )
        .optional(),
      members: z
        .array(
          z.object({
            memberName: z.string(),
            roleLabel: z.string().nullable().optional(),
            responsibilities: z.array(z.string()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  spaceMembers: z
    .array(
      z.object({
        personId: z.number(),
        name: z.string(),
      }),
    )
    .max(200)
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(2000),
      }),
    )
    .max(20)
    .optional(),
});

export type QuestDraftAssistRequest = z.infer<
  typeof questDraftAssistRequestSchema
>;

const QUEST_DRAFT_MS = 14_000;

export async function assistSpaceQuestDraft({
  spaceSlug,
  input,
}: {
  spaceSlug: string;
  input: QuestDraftAssistRequest;
}): Promise<{
  ok: true;
  patch: QuestDraftAssistPatch | null;
  reply: string | null;
  specialistId: string;
}> {
  const {
    message,
    currentStep = 'goal',
    spaceTitle,
    draft,
    spaceMembers = [],
    history = [],
  } = input;

  const specialist =
    selectSpecialistForQuestion(message) ?? specialistById('operations');

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return {
      ok: true,
      patch: null,
      reply: null,
      specialistId: specialist?.id ?? 'operations',
    };
  }

  let collectedPatch: QuestDraftAssistPatch = {};
  const tools: ToolSet = {
    update_quest_draft: tool({
      description:
        'Fill or update one or more sections of the live Quest draft form on screen. Call this whenever the member provides information for any section OR asks you to draft, suggest, or fill sections.',
      inputSchema: draftPatchSchema,
      execute: async (patchInput) => {
        collectedPatch = { ...collectedPatch, ...patchInput };
        return { ok: true, updatedFields: Object.keys(patchInput) };
      },
    }),
  };

  const memberNamesPreview = spaceMembers
    .slice(0, 40)
    .map((m) => m.name)
    .join(', ');

  const system = `You are AI Agents (${
    specialist?.role ?? 'Operations Lead'
  }), the shared Hypha platform agent helping a member in the right-side chat panel draft a new Quest for space "${
    spaceTitle || spaceSlug
  }".

CORE PRINCIPLE — "THE AI DOES IT FOR ME":
- Always call update_quest_draft to fill or refine the Quest draft sections on screen so the member does not have to fill the form manually.
- Quest sections (in guided order, NO Priority field ever):
  1. goal — clear 1–2 sentence outcome of the quest
  2. scopeIn / scopeOut — concrete bullet items of what is in scope vs explicitly out of scope
  3. successCriteriaBullets — measurable bullet outcomes that prove the quest succeeded
  4. milestones — ordered checkpoints (name, dueDate, description, ownerName)
  5. members — quest members and their concrete responsibility bullets (match names from space members when possible: ${
    memberNamesPreview || 'none listed'
  })
  6. leadName — quest lead display name
  7. targetDate — target completion date (e.g. "Dec 15, 2026")
  8. rewards — array of { amount, token } (e.g. [{ amount: "2,500", token: "USDC" }])
  9. name — concise quest title (2–6 words)
- If the member asks you to draft, suggest, or auto-fill sections (or gives a high-level goal/idea and asks for help), proactively draft concrete, high-signal values for the requested sections (or Goal + Scope + Success Criteria + Milestones + Name) via update_quest_draft!
- If the member answers the current section (${
    currentStep as QuestStewardStep
  }), call update_quest_draft for ${currentStep} (and any other sections they mentioned, plus a concise quest name if name is still empty and goal is clear).
- Keep your text reply to 1–3 concise sentences: state what you filled into the draft, then ask ONE focused question for the next unfilled section (or invite them to click CREATE QUEST if all key sections are filled). Never mention Priority.`;

  const historyLines = history
    .slice(-8)
    .map((h) => `${h.role === 'user' ? 'Member' : 'AI Agents'}: ${h.text}`)
    .join('\n');

  const prompt = [
    `Current Quest draft state:\n${JSON.stringify(draft ?? {}, null, 2)}`,
    historyLines ? `Recent chat:\n${historyLines}` : null,
    `Current guided section: ${currentStep}`,
    `Member's message:\n${message}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), QUEST_DRAFT_MS);
  try {
    const result = await generateText({
      model: getHyphaChatModel(),
      system,
      prompt,
      tools,
      stopWhen: stepCountIs(3),
      abortSignal: abort.signal,
    });

    return {
      ok: true,
      patch: Object.keys(collectedPatch).length > 0 ? collectedPatch : null,
      reply: result.text.trim().slice(0, 1200) || null,
      specialistId: specialist?.id ?? 'operations',
    };
  } catch (error) {
    console.warn(
      '[space-quests.draft-assist] model fallback:',
      error instanceof Error ? error.message : error,
    );
    return {
      ok: true,
      patch: Object.keys(collectedPatch).length > 0 ? collectedPatch : null,
      reply: null,
      specialistId: specialist?.id ?? 'operations',
    };
  } finally {
    clearTimeout(timer);
  }
}
