/** User-facing phrases that sound like internal discovery — never say these to members. */
export const PROPOSAL_DISCOVERY_NARRATION_FORBIDDEN = [
  'it looks like i need',
  'it looks like we need',
  'i now need to',
  "i'll need to",
  'i need to add',
  'we need to add',
  'let me add',
  'first i need to',
  'it seems i need',
  'looking at this',
  'i need to draft',
  'i need to collect',
  'next i need to ask',
  'before we proceed i need',
] as const;

export const PROPOSAL_PREMATURE_COMPLETE_FORBIDDEN = [
  'now complete',
  'is complete',
  'proposal is complete',
  'all set',
  'ready to publish',
  'click publish',
  'review the details and click publish',
  'you can publish',
] as const;

export const PROPOSAL_MEMBER_VOICE_GUIDELINE = `
Member-facing voice during proposals (chat and Live Voice):
- You are DOING the work — not discovering requirements aloud. Never narrate your internal checklist.
- FORBIDDEN: "It looks like I need to…", "I now need to add…", "I'll need to…", "Let me add…", "First I need to ask…", "It seems I need to draft…"
- FORBIDDEN until every mandatory field is on the form AND get_proposal_form_state.ready_to_publish is true: "complete", "now complete", "click Publish", "ready to publish", "all set"
- INSTEAD: "I've drafted…", "I'll open the form with…", "I'm setting…", "Next up…", "I've put … on the form — take a look."
- Call tools silently; the member sees the form update — if they say fields are empty, believe the form over your memory.`;
