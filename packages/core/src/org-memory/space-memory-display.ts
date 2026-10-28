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

/**
 * Drop a title that was derived from the opening of the same body so the
 * Space Memory card does not repeat the first sentence under the heading.
 */
export function memoryBodyWithoutRepeatedTitle(
  title: string,
  body: string,
): string {
  const heading = title.replace(/\s+/g, ' ').trim();
  const text = body.replace(/\s+/g, ' ').trim();
  if (!heading || !text) return body.trim();
  if (text.toLowerCase() === heading.toLowerCase()) return '';
  if (text.toLowerCase().startsWith(heading.toLowerCase())) {
    return text
      .slice(heading.length)
      .replace(/^[\s—–\-:.,]+/u, '')
      .trim();
  }
  return body.trim();
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

const BRIDGED_PRIVY_ID =
  /@?(?:dev|prev|prod)_privy_did_privy_[a-z0-9]+(?::[^\s:,]+)?/gi;
const DID_PRIVY = /did:privy:[a-z0-9]+/gi;

/** Drop bridged Privy / Matrix ids that leak into memory titles and bodies. */
export function scrubTechnicalIdentityTokens(text: string): string {
  return text
    .replace(BRIDGED_PRIVY_ID, ' ')
    .replace(DID_PRIVY, ' ')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n[^\S\n]+/g, '\n')
    .trim();
}

/**
 * Discussion summaries are markdown, but Matrix reply fallbacks land in them
 * as `<@user:server>` mentions and `>` quotes. Keep the sentences.
 * Call transcripts often start with bridged `prod_privy_…:` speaker labels.
 */
export function humanizeMemoryExcerpt(source: string): string {
  const trimmed = source.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';

  const rawLines = trimmed.split('\n');
  const hasTechnicalSpeakers = rawLines.some((line) => {
    const parsed = splitSpeakerLabeledTranscriptLine(line.trim());
    if (!parsed || !looksLikeTechnicalSpeakerLabel(parsed.speaker)) {
      return false;
    }
    // Reply dumps wrap MXIDs in `<@…>` / `>`; real transcript lines are bare.
    return !/[<>]/.test(parsed.speaker);
  });
  if (hasTechnicalSpeakers) {
    return rawLines
      .map((line) =>
        scrubTechnicalIdentityTokens(stripTechnicalSpeakerFromExcerpt(line)),
      )
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  const mention = /<?@[A-Za-z0-9._=\-/]+:[A-Za-z0-9.\-]+(?::\d+)?>?/;
  if (!mention.test(trimmed) && !/(?:^|\s)>+/.test(trimmed)) {
    return scrubTechnicalIdentityTokens(trimmed);
  }
  const withoutMentions = trimmed.replace(new RegExp(mention.source, 'g'), ' ');
  const lines = withoutMentions
    .split('\n')
    .map((line) =>
      line
        .replace(/^(?:>\s*)+/g, '')
        .replace(/(?:^|\s)>+(?:[ \t]*>)*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  return scrubTechnicalIdentityTokens(lines.join(' '));
}

/** Strip a technical speaker prefix from a transcript excerpt line. */
export function stripTechnicalSpeakerFromExcerpt(excerpt: string): string {
  const trimmed = excerpt.trim();
  if (!trimmed) return '';
  const parsed = splitSpeakerLabeledTranscriptLine(trimmed);
  if (!parsed) return scrubTechnicalIdentityTokens(trimmed);
  const body = parsed.body.trim();
  if (!body) return '';
  if (looksLikeTechnicalSpeakerLabel(parsed.speaker)) {
    return scrubTechnicalIdentityTokens(body);
  }
  return scrubTechnicalIdentityTokens(trimmed);
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
