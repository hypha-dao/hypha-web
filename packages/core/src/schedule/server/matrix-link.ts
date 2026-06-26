import {
  buildScheduledCallJoinPath,
  type MatrixAutoLinkInput,
} from '../matrix-link';
import { toAbsoluteAppUrl } from './app-origin';

export function applyMatrixAutoLink<T extends MatrixAutoLinkInput>(
  input: T,
  args: {
    spaceSlug: string;
    chatRoomId?: string | null;
    lang?: string;
  },
): T {
  if (!input.matrixAutoLink) return input;
  if (input.type && input.type !== 'call' && input.type !== 'meeting')
    return input;
  if (!input.type) return input;

  const lang = args.lang?.trim() || 'en';
  const joinPath = buildScheduledCallJoinPath(lang, args.spaceSlug);
  const meetingUrl = input.meetingUrl?.trim() || toAbsoluteAppUrl(joinPath);

  return {
    ...input,
    matrixRoomId: args.chatRoomId?.trim() || input.matrixRoomId || null,
    meetingUrl,
  };
}
