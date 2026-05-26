import {
  looksLikeTechnicalSpeakerLabel,
  splitSpeakerLabeledTranscriptLine,
} from '../matrix/matrix-member-display';
import type { SpaceMemorySource } from './build-space-memory-items';

const TECHNICAL_FILENAME =
  /^(?:call[-_]?(?:transcript|recording)|discussion[-_]summary|attachment|memory)(?:[-_.]|$)/i;
const LONG_HEX = /^[a-f0-9]{24,}(?:\.[a-z0-9]+)?$/i;
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-z0-9]+)?$/i;
/** Matrix MXC segment / UploadThing keys — not human-readable titles. */
const OPAQUE_MEDIA_KEY = /^[A-Za-z0-9_-]{30,}$/;

/** True when a Space Memory label looks like a hash, synthetic filename, or bridged id. */
export function looksLikeTechnicalSpaceMemoryName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('mxc://') || trimmed.startsWith('memory://')) {
    return true;
  }
  if (TECHNICAL_FILENAME.test(trimmed)) return true;
  if (LONG_HEX.test(trimmed)) return true;
  if (UUID_LIKE.test(trimmed)) return true;
  if (OPAQUE_MEDIA_KEY.test(trimmed)) return true;
  if (looksLikeTechnicalSpeakerLabel(trimmed)) return true;
  if (/privy_did_privy/i.test(trimmed)) return true;
  if (/^prod_[a-z0-9_]+$/i.test(trimmed) && trimmed.length > 20) return true;
  return false;
}

function firstSentence(text: string, maxLen = 120): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const match = compact.match(/^(.{20,120}?[.!?])(?:\s|$)/);
  if (match?.[1]) return match[1].trim();
  if (compact.length <= maxLen) return compact;
  const cut = compact.slice(0, maxLen);
  const stop = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  );
  return (stop > 40 ? cut.slice(0, stop + 1) : `${cut}…`).trim();
}

/** Strip a technical speaker prefix from a transcript excerpt line. */
export function stripTechnicalSpeakerFromExcerpt(excerpt: string): string {
  const trimmed = excerpt.trim();
  if (!trimmed) return '';
  const parsed = splitSpeakerLabeledTranscriptLine(trimmed);
  if (!parsed) return trimmed;
  const body = parsed.body.trim();
  if (!body) return trimmed;
  if (looksLikeTechnicalSpeakerLabel(parsed.speaker)) return body;
  return trimmed;
}

function pickHumanReadableCandidate(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (looksLikeTechnicalSpaceMemoryName(trimmed)) continue;
    return trimmed;
  }
  return '';
}

export function deriveSpaceMemoryDisplayTitle(input: {
  source: SpaceMemorySource;
  name: string;
  contextTitle?: string | null;
  textExcerpt?: string | null;
  documentTitle?: string | null;
}): string {
  const fromContext = pickHumanReadableCandidate(
    input.contextTitle,
    input.documentTitle,
  );
  if (fromContext) return fromContext;

  const excerptBody = stripTechnicalSpeakerFromExcerpt(
    input.textExcerpt?.trim() ?? '',
  );
  const fromExcerpt = firstSentence(excerptBody);
  if (fromExcerpt && !looksLikeTechnicalSpaceMemoryName(fromExcerpt)) {
    return fromExcerpt;
  }

  const fromName = pickHumanReadableCandidate(input.name);
  if (fromName) return fromName;

  switch (input.source) {
    case 'call_transcript':
      return 'Group call transcript';
    case 'call_recording':
      return 'Group call recording';
    case 'discussion_summary':
      return 'Conversation summary';
    default:
      return 'Memory item';
  }
}
