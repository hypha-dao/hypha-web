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

export function buildMemberGuidance(input: {
  firstName: string;
  orientation: MemberOrientation | null;
  attention: {
    title: string;
    spaceTitle: string;
    kind: MemberAttentionKind;
  } | null;
  spaceCount: number;
}): string {
  const name = input.firstName.trim() || 'there';
  const lead = input.attention;

  if (lead) {
    const action =
      lead.kind === 'proposal'
        ? 'is open for a decision'
        : 'is asking for attention';
    return `Hi ${name}. ${lead.title} in ${lead.spaceTitle} ${action}. That is the most useful place to step in right now.`;
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

  if (input.orientation === 'builder') {
    return `Hi ${name}. Nothing is waiting on a decision. Your spaces are quiet, which is a good moment to shape the next one around a vision.`;
  }
  if (input.orientation === 'investor') {
    return `Hi ${name}. Nothing in your spaces is waiting on you. The network marketplace is where spaces publish their asks.`;
  }
  return `Hi ${name}. Nothing is waiting on a decision. Look through your spaces and the people around you.`;
}
