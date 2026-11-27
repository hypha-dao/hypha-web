/**
 * Session keys read by the quest create draft and the collective-agreement form.
 * Kept here so the signal page does not import those modules.
 */
const QUEST_CREATE_SESSION_PREFIX = 'hypha-quest-create:';
const PROPOSAL_SESSION_KEY = 'resubmitProposalData';

export type SignalConvertSource = {
  title?: string | null;
  description?: string | null;
  /** Space domain slug. Quests store this; proposals do not. */
  board?: string | null;
};

type StorageLike = Pick<Storage, 'setItem'> | null | undefined;

function clean(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function questPathFromSignal(lang: string, spaceSlug: string): string {
  return `/${lang}/dho/${spaceSlug}/quests/new`;
}

export function proposalPathFromSignal(
  lang: string,
  spaceSlug: string,
): string {
  return `/${lang}/dho/${spaceSlug}/agreements/create`;
}

/** Quest title, goal, and domain. Other quest fields stay empty. */
export function writeQuestFromSignal(
  storage: StorageLike,
  spaceSlug: string,
  source: SignalConvertSource,
): void {
  if (!storage) return;
  const domain = clean(source.board);
  storage.setItem(
    `${QUEST_CREATE_SESSION_PREFIX}${spaceSlug}`,
    JSON.stringify({
      draft: {
        name: clean(source.title),
        goal: clean(source.description),
        scopeIn: [],
        scopeOut: [],
        scopeInMarkdown: '',
        scopeOutMarkdown: '',
        successCriteria: '',
        rewards: [],
        milestones: [],
        leadName: '',
        selectedLeadPersonId: null,
        members: [],
        targetDate: null,
        domain: domain || null,
        deliverables: [],
      },
      messages: [],
      step: 0,
      pending: null,
      checkpoint: null,
      draftId: null,
    }),
  );
}

/** Collective-agreement title and description. */
export function writeProposalFromSignal(
  storage: StorageLike,
  source: SignalConvertSource,
): void {
  if (!storage) return;
  storage.setItem(
    PROPOSAL_SESSION_KEY,
    JSON.stringify({
      resubmitTemplateSegment: '',
      title: clean(source.title),
      description: clean(source.description),
      applied: false,
    }),
  );
}
