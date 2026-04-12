/**
 * Matrix timeline attachment slice shared by chat list, bubbles, and HumanRightPanel.
 */
export type ChatPanelAttachmentMedia = {
  msgtype: 'm.file' | 'm.image';
  mxcUrl?: string;
  filename?: string;
  mediaInfo?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
  };
  spoiler?: boolean;
};

const VIDEO_FILE_EXTENSIONS = new Set([
  'mov',
  'mp4',
  'webm',
  'mkv',
  'avi',
  'm4v',
  'mpeg',
  'mpg',
  'ogv',
  '3gp',
]);

function extensionFromFileNameHint(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  if (!base.includes('.')) return '';
  return base.split('.').pop()?.toLowerCase() ?? '';
}

/** Local file or Matrix `info.mimetype` + name (composer drafts, timeline). */
export function looksLikeVideoMimeOrName(
  mimetype?: string,
  filename?: string,
): boolean {
  const mt = mimetype?.toLowerCase() ?? '';
  if (mt.startsWith('video/')) return true;
  const ext = extensionFromFileNameHint(filename ?? '');
  return VIDEO_FILE_EXTENSIONS.has(ext);
}

/** Treat Matrix `m.file` as inline video when MIME or filename indicates video. */
export function isChatPanelVideoFile(
  media: Pick<ChatPanelAttachmentMedia, 'msgtype' | 'mediaInfo' | 'filename'>,
): boolean {
  if (media.msgtype !== 'm.file') return false;
  return looksLikeVideoMimeOrName(
    media.mediaInfo?.mimetype,
    media.filename ?? '',
  );
}
