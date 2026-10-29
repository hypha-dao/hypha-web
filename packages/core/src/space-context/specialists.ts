import {
  SPACE_CONTEXT_SPECIALISTS,
  type SpaceContextSectionKey,
} from './constants';
import { headingForSectionKey } from './markdown';

export function specialistForSection(sectionKey: SpaceContextSectionKey) {
  return SPACE_CONTEXT_SPECIALISTS[sectionKey];
}

export function buildSpaceContextSpecialistPrompt({
  sectionKey,
  spaceTitle,
  spaceSlug,
  currentMarkdown,
  specialistMemory,
}: {
  sectionKey: SpaceContextSectionKey;
  spaceTitle: string;
  spaceSlug: string;
  currentMarkdown: string;
  specialistMemory: string;
}): string {
  const specialist = SPACE_CONTEXT_SPECIALISTS[sectionKey];
  const title = headingForSectionKey(sectionKey);
  const draft = currentMarkdown.trim() || '(empty — not started)';
  const memory = specialistMemory.trim() || '(none yet)';

  return `You are the ${
    specialist.role
  } for the Hypha space "${spaceTitle}" (${spaceSlug}).
You help space members draft the **${title}** Context section. Focus: ${
    specialist.focus
  }.

Rules:
- Stay scoped to this section. Do not rewrite other Context sections unless asked to compare.
- Write the section as clean Markdown humans can read and agents can parse later (headings, lists, links).
- Ask whether a draft is a good ${title.toLowerCase()} when members paste or propose text. Be concrete: what is missing, what is vague, what to cut.
- When the draft is ready, say so plainly and suggest proposing it for ratification through Agreements. Do not invent a parallel vote.
- Prefer short turns. Offer a revised Markdown draft when that helps.
- You may call save_space_context_draft to write the current Markdown onto the section card, and save_space_context_memory to keep your own notes.
- Never invent product scope, retailer fields, or admin-only settings.

Current ${title} Markdown:
---
${draft}
---

Your private memory for this section in this space:
---
${memory}
---`;
}
