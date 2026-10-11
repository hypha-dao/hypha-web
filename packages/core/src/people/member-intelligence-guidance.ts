export const MEMBER_ORIENTATIONS = ['member', 'builder', 'investor'] as const;
export type MemberOrientation = (typeof MEMBER_ORIENTATIONS)[number];

export type MemberAttentionKind = 'proposal' | 'signal';

export function parseMemberOrientation(
  value: string | null | undefined,
): MemberOrientation | null {
  if (value === 'member' || value === 'builder' || value === 'investor') {
    return value;
  }
  return null;
}

function invitation(category: string | null | undefined): string {
  switch ((category ?? '').trim().toLowerCase()) {
    case 'need':
    case 'action':
      return 'Can you make it?';
    case 'resource':
      return 'Want to draw on it?';
    case 'tension':
    case 'risk':
      return 'Want to talk it through?';
    case 'impact':
      return 'Want to see what changed?';
    case 'opportunity':
      return 'Want to look at it together?';
    default:
      return 'Want a little more context?';
  }
}

export function buildMemberGuidance(input: {
  firstName: string;
  orientation: MemberOrientation | null;
  attention: {
    title: string;
    spaceTitle: string;
    kind: MemberAttentionKind;
    category?: string | null;
    summary?: string | null;
    creatorName?: string | null;
    documentState?: string | null;
  } | null;
  spaceCount: number;
}): string {
  const name = input.firstName.trim() || 'there';
  const lead = input.attention;

  if (lead) {
    const summary = lead.summary?.trim();
    const who = lead.creatorName?.trim();
    if (lead.kind === 'signal' && who && summary) {
      return `Hi ${name}. ${who} in ${
        lead.spaceTitle
      } shared this: ${summary} ${invitation(lead.category)}`;
    }
    if (lead.documentState?.trim().toLowerCase() === 'discussion') {
      const summary = lead.summary?.trim();
      const who = lead.creatorName?.trim();
      const detail = [who ? `${who} opened it.` : null, summary]
        .filter(Boolean)
        .join(' ');
      return `Hi ${name}. The latest discussion is ${lead.title} in ${
        lead.spaceTitle
      }.${detail ? ` ${detail}` : ''} Ready to take a look?`;
    }
    if (lead.kind === 'proposal') {
      return `Hi ${name}. ${lead.title} in ${lead.spaceTitle} is open for a vote. The choice stays with you.`;
    }
    return `Hi ${name}. ${lead.title} in ${lead.spaceTitle} is the next one. Ready to take a look?`;
  }

  if (input.spaceCount === 0) {
    if (input.orientation === 'builder') {
      return `Hi ${name}. You are not in a space yet. When a vision is ready, shape a space around it and invite the people who should build it with you.`;
    }
    if (input.orientation === 'investor') {
      return `Hi ${name}. You are not in a space yet. The network marketplace lists what spaces are asking for, when you want to deploy capital.`;
    }
    return `Hi ${name}. You are not in a space yet. Join one to take part in decisions, or create a space when you are ready to bring people together.`;
  }

  return `Hi ${name}. Activate a space you are in, or open your horizon and listen to the network.`;
}
