// server-only: reached only from API route handlers (#2485 POC).

/**
 * #2485 POC — hardcoded persona map. No DB, no per-persona env. The localpart in a mention
 * (`@hyphabot_<localpart>:<hs>`) selects the persona.
 */

export type PersonaToolName = 'read_file' | 'create_signal';

export interface Persona {
  /** Matrix localpart, e.g. `hyphabot_qa` → `@hyphabot_qa:<serverName>`. */
  localpart: string;
  /** Human label (used only in logs / canned copy). */
  label: string;
  /** System prompt prefix; the pinned context and question are appended at build time. */
  systemPrompt: string;
  tools: PersonaToolName[];
}

const QA_SYSTEM = `You are the Hypha platform assistant "QA Bot", answering questions inside a Hypha Space chat room.
Answer ONLY from the provided context files and anything you retrieve with the read_file tool.
If the answer is not in the context, say so plainly — do not guess or use outside knowledge.
Be concise (a short paragraph or a few bullets). Cite the file path you drew each fact from.`;

const PLATFORM_SYSTEM = `You are "Platform Bot", a Hypha platform architecture guide speaking in a Space chat room.
Use the provided context files and the read_file tool. Focus on how the platform is built —
services, packages, data flow, deployment. Prefer a structured answer (headings or bullets) over prose.
When the context does not cover something, say which file you would expect it in. Cite file paths.`;

const ACTIONS_SYSTEM = `You are "Actions Bot" in a Hypha Space chat room. You can answer questions from the
provided context, and you may use the create_signal tool when the user clearly asks to create/record a
signal (an Opportunity, Risk, Tension, Insight, Trend, or Proposal) for this space.
Before calling create_signal, restate the title and type you are about to use. After the tool returns,
relay its result verbatim to the user in one sentence. Cite file paths for any factual claims.`;

export const PERSONAS: Record<string, Persona> = {
  hyphabot_qa: {
    localpart: 'hyphabot_qa',
    label: 'QA Bot',
    systemPrompt: QA_SYSTEM,
    tools: ['read_file'],
  },
  hyphabot_platform: {
    localpart: 'hyphabot_platform',
    label: 'Platform Bot',
    systemPrompt: PLATFORM_SYSTEM,
    tools: ['read_file'],
  },
  hyphabot_actions: {
    localpart: 'hyphabot_actions',
    label: 'Actions Bot',
    systemPrompt: ACTIONS_SYSTEM,
    tools: ['read_file', 'create_signal'],
  },
};

const MXID_MENTION_RE = /^@(hyphabot_[a-z0-9_]+):/i;
// Fallback for clients that don't emit m.mentions / a matrix.to pill (plain-text "@hyphabot_qa").
const TEXT_MENTION_RE = /@(hyphabot_[a-z0-9_]+)\b/gi;

/** First mentioned MXID that resolves to a known persona, or `null`. */
export function resolvePersonaFromMentions(
  mentionedMatrixUserIds: string[],
): Persona | null {
  for (const mxid of mentionedMatrixUserIds) {
    const m = MXID_MENTION_RE.exec(mxid.trim());
    const localpart = m?.[1]?.toLowerCase();
    if (localpart && PERSONAS[localpart]) return PERSONAS[localpart];
  }
  return null;
}

/** Persona named by a plain-text `@hyphabot_*` token in the message body, or `null`. */
export function resolvePersonaFromText(body: string): Persona | null {
  for (const match of body.matchAll(TEXT_MENTION_RE)) {
    const localpart = match[1]?.toLowerCase();
    if (localpart && PERSONAS[localpart]) return PERSONAS[localpart];
  }
  return null;
}

/** Mentions-first, then body-text fallback. */
export function resolvePersona(
  mentionedMatrixUserIds: string[],
  body: string,
): Persona | null {
  return (
    resolvePersonaFromMentions(mentionedMatrixUserIds) ??
    resolvePersonaFromText(body)
  );
}

/** True when the sender is one of the POC bots (loop guard). */
export function isPocBotSender(actorMatrixUserId: string): boolean {
  return /^@hyphabot_/i.test(actorMatrixUserId.trim());
}
