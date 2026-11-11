import type { SpaceQuestDraftChatMessage } from '../../common/human-chat-panel-context';
import type {
  PendingQuestSectionProposal,
  QuestDraftStateSnapshot,
} from './quest-draft-assistant';

export type QuestCreateCheckpoint = {
  questSlug: string;
  agreementId: number;
  agreementSlug: string | null;
  proposalTitle: string;
};

export type QuestCreateSession = {
  draft: QuestDraftStateSnapshot;
  messages: SpaceQuestDraftChatMessage[];
  step: number;
  pending: PendingQuestSectionProposal | null;
  checkpoint: QuestCreateCheckpoint | null;
  /** Server row for this draft. Null until the first save. */
  draftId: number | null;
};

const MAX_MESSAGES = 40;

const STEPS = new Set([
  'goal',
  'scope',
  'success',
  'milestones',
  'members',
  'lead',
  'targetDate',
  'rewards',
  'name',
]);

export function questCreateSessionKey(spaceSlug: string): string {
  return `hypha-quest-create:${spaceSlug}`;
}

function emptyDraft(): QuestDraftStateSnapshot {
  return {
    name: '',
    goal: '',
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
    deliverables: [],
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readDraft(value: unknown): QuestDraftStateSnapshot {
  const draft = emptyDraft();
  if (!value || typeof value !== 'object') return draft;
  const row = value as Record<string, unknown>;
  if (typeof row.name === 'string') draft.name = row.name;
  if (typeof row.goal === 'string') draft.goal = row.goal;
  draft.scopeIn = stringList(row.scopeIn);
  draft.scopeOut = stringList(row.scopeOut);
  if (typeof row.scopeInMarkdown === 'string') {
    draft.scopeInMarkdown = row.scopeInMarkdown;
  }
  if (typeof row.scopeOutMarkdown === 'string') {
    draft.scopeOutMarkdown = row.scopeOutMarkdown;
  }
  if (typeof row.successCriteria === 'string') {
    draft.successCriteria = row.successCriteria;
  }
  if (typeof row.leadName === 'string') draft.leadName = row.leadName;
  if (typeof row.selectedLeadPersonId === 'number') {
    draft.selectedLeadPersonId = row.selectedLeadPersonId;
  }
  if (typeof row.targetDate === 'string' || row.targetDate === null) {
    draft.targetDate = row.targetDate;
  }
  if (Array.isArray(row.rewards)) {
    draft.rewards = row.rewards.filter(
      (reward): reward is QuestDraftStateSnapshot['rewards'][number] =>
        !!reward &&
        typeof reward === 'object' &&
        typeof (reward as { amount?: unknown }).amount === 'string' &&
        typeof (reward as { token?: unknown }).token === 'string',
    );
  }
  if (Array.isArray(row.milestones)) {
    draft.milestones = row.milestones.filter(
      (milestone): milestone is QuestDraftStateSnapshot['milestones'][number] =>
        !!milestone &&
        typeof milestone === 'object' &&
        typeof (milestone as { name?: unknown }).name === 'string',
    );
  }
  if (Array.isArray(row.deliverables)) {
    draft.deliverables = row.deliverables.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const rowItem = item as {
        id?: unknown;
        name?: unknown;
        url?: unknown;
        note?: unknown;
      };
      if (typeof rowItem.name !== 'string' || !rowItem.name.trim()) return [];
      return [
        {
          ...(typeof rowItem.id === 'number' ? { id: rowItem.id } : {}),
          name: rowItem.name,
          url: typeof rowItem.url === 'string' ? rowItem.url : '',
          note: typeof rowItem.note === 'string' ? rowItem.note : '',
        },
      ];
    });
  }
  if (Array.isArray(row.members)) {
    draft.members = row.members.filter(
      (member): member is QuestDraftStateSnapshot['members'][number] =>
        !!member &&
        typeof member === 'object' &&
        typeof (member as { memberName?: unknown }).memberName === 'string',
    );
  }
  return draft;
}

function readCheckpoint(value: unknown): QuestCreateCheckpoint | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.questSlug !== 'string' || !row.questSlug) return null;
  if (typeof row.agreementId !== 'number') return null;
  if (typeof row.proposalTitle !== 'string') return null;
  return {
    questSlug: row.questSlug,
    agreementId: row.agreementId,
    agreementSlug:
      typeof row.agreementSlug === 'string' ? row.agreementSlug : null,
    proposalTitle: row.proposalTitle,
  };
}

function readPending(value: unknown): PendingQuestSectionProposal | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.step !== 'string' || !STEPS.has(row.step)) return null;
  if (!row.patch || typeof row.patch !== 'object') return null;
  return row as PendingQuestSectionProposal;
}

export function readQuestCreateSession(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  key: string,
): QuestCreateSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      draft?: unknown;
      messages?: Array<Record<string, unknown>>;
      step?: number;
      pending?: unknown;
      checkpoint?: unknown;
      draftId?: unknown;
    };
    const messages = (parsed.messages ?? [])
      .filter(
        (message) =>
          message &&
          (message.role === 'user' || message.role === 'member') &&
          typeof message.text === 'string' &&
          typeof message.id === 'string',
      )
      .slice(-MAX_MESSAGES)
      .map((message) => ({
        id: message.id as string,
        role: message.role as 'user' | 'member',
        text: message.text as string,
        timestamp: new Date(
          typeof message.timestamp === 'string' ? message.timestamp : 0,
        ),
        ...(typeof message.senderName === 'string'
          ? { senderName: message.senderName }
          : {}),
        ...(typeof message.senderMatrixId === 'string'
          ? { senderMatrixId: message.senderMatrixId }
          : {}),
        ...(typeof message.avatarUrl === 'string'
          ? { avatarUrl: message.avatarUrl }
          : {}),
        ...(typeof message.agentSpecialistId === 'string'
          ? { agentSpecialistId: message.agentSpecialistId }
          : {}),
      }));
    const draft = readDraft(parsed.draft);
    const checkpoint = readCheckpoint(parsed.checkpoint);
    const draftId =
      typeof parsed.draftId === 'number' && parsed.draftId > 0
        ? parsed.draftId
        : null;
    if (
      messages.length === 0 &&
      !draft.name &&
      !draft.goal &&
      !checkpoint &&
      !draftId
    ) {
      return null;
    }
    return {
      draft,
      messages,
      step:
        typeof parsed.step === 'number' && parsed.step >= 0 ? parsed.step : 0,
      pending: readPending(parsed.pending),
      checkpoint,
      draftId,
    };
  } catch {
    return null;
  }
}

export function writeQuestCreateSession(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  key: string,
  session: QuestCreateSession,
): void {
  if (!storage) return;
  try {
    const messages = session.messages.slice(-MAX_MESSAGES).map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      timestamp: message.timestamp.toISOString(),
      ...(message.senderName ? { senderName: message.senderName } : {}),
      ...(message.senderMatrixId
        ? { senderMatrixId: message.senderMatrixId }
        : {}),
      ...(message.avatarUrl ? { avatarUrl: message.avatarUrl } : {}),
      ...(message.agentSpecialistId
        ? { agentSpecialistId: message.agentSpecialistId }
        : {}),
    }));
    storage.setItem(
      key,
      JSON.stringify({
        draft: session.draft,
        messages,
        step: session.step,
        pending: session.pending,
        checkpoint: session.checkpoint,
        draftId: session.draftId,
      }),
    );
  } catch {
    // A full or blocked session store still leaves the live draft intact.
  }
}

/** A greeting-only page is not a draft worth keeping. */
export function questCreateDraftIsWorthSaving(
  session: Pick<QuestCreateSession, 'draft' | 'messages' | 'pending'>,
): boolean {
  const draft = session.draft;
  if (draft.name.trim() || draft.goal.trim() || draft.successCriteria.trim()) {
    return true;
  }
  if (
    draft.scopeIn.length > 0 ||
    draft.scopeOut.length > 0 ||
    draft.scopeInMarkdown.trim() ||
    draft.scopeOutMarkdown.trim()
  ) {
    return true;
  }
  if (
    draft.rewards.length > 0 ||
    draft.milestones.length > 0 ||
    draft.members.length > 0 ||
    draft.targetDate ||
    (draft.deliverables?.length ?? 0) > 0
  ) {
    return true;
  }
  if (session.pending) return true;
  if (session.messages.some((message) => message.role === 'user')) return true;
  return session.messages.length > 1;
}

export function questCreateDraftPayload(session: QuestCreateSession) {
  return {
    draft: session.draft,
    messages: session.messages.slice(-MAX_MESSAGES).map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      timestamp: message.timestamp.toISOString(),
      ...(message.senderName ? { senderName: message.senderName } : {}),
      ...(message.senderMatrixId
        ? { senderMatrixId: message.senderMatrixId }
        : {}),
      ...(message.avatarUrl ? { avatarUrl: message.avatarUrl } : {}),
      ...(message.agentSpecialistId
        ? { agentSpecialistId: message.agentSpecialistId }
        : {}),
    })),
    step: session.step,
    pending: session.pending,
  };
}
