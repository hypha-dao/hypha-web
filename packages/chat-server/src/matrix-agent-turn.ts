import { HYPHA_MEDIA_BUNDLE_FIELD } from '@hypha-platform/core/client';

export type AgentRoomLine = {
  sender: string;
  body: string;
  mentionsAgent: boolean;
};

const MEDIA_MSGTYPES = new Set(['m.file', 'm.image', 'm.audio', 'm.video']);

export function isMatrixMediaMsgtype(msgtype: unknown): boolean {
  return typeof msgtype === 'string' && MEDIA_MSGTYPES.has(msgtype);
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** Caption plus one "Attached file" line per file, so the agent can read it. */
export function mediaEventText(content: Record<string, unknown>): string {
  const files: string[] = [];
  const addFile = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const slot = item as Record<string, unknown>;
    const url = typeof slot.url === 'string' ? slot.url.trim() : '';
    if (!url.startsWith('mxc://')) return;
    const name =
      (typeof slot.filename === 'string' && oneLine(slot.filename)) ||
      (typeof slot.body === 'string' && oneLine(slot.body)) ||
      'attachment';
    files.push(`Attached file: ${name} (${url})`);
  };
  addFile(content);
  const bundle = content[HYPHA_MEDIA_BUNDLE_FIELD];
  if (Array.isArray(bundle)) bundle.forEach(addFile);

  const body = typeof content.body === 'string' ? content.body.trim() : '';
  const filename =
    typeof content.filename === 'string' ? content.filename.trim() : '';
  // Without a caption, Matrix puts the file name in the body.
  const caption = filename && body !== filename ? body : '';
  return [caption, ...files].filter(Boolean).join('\n');
}

export type AgentTurnLimits = {
  /** Earlier lines kept before the mention. */
  earlierLines: number;
  /** Characters kept from each earlier line. */
  earlierChars: number;
  /** Characters kept from the message that mentioned the agent. */
  questionChars: number;
  /** How the agent's own earlier lines are labelled. */
  agentLabel: string;
};

const DEFAULT_LIMITS: AgentTurnLimits = {
  earlierLines: 12,
  earlierChars: 500,
  questionChars: 2000,
  agentLabel: 'Hypha',
};

/**
 * The latest text message is the only one that can invite the agent. A later message that
 * does not mention it, or a reply already posted, leaves the room alone.
 */
export function mentionAwaitingAgent(
  newestFirst: AgentRoomLine[],
  agentUserId: string,
  limits: Partial<AgentTurnLimits> = {},
): { question: string; earlier: string } | null {
  const { earlierLines, earlierChars, questionChars, agentLabel } = {
    ...DEFAULT_LIMITS,
    ...limits,
  };
  const latest = newestFirst[0];
  if (!latest || latest.sender === agentUserId || !latest.mentionsAgent) {
    return null;
  }
  const earlier = newestFirst
    .slice(1)
    .reverse()
    .slice(-earlierLines)
    .map((line) => {
      const speaker = line.sender === agentUserId ? agentLabel : 'member';
      return `${speaker}: ${line.body.slice(0, earlierChars)}`;
    })
    .join('\n');
  return { question: latest.body.slice(0, questionChars), earlier };
}
