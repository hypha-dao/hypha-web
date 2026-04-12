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
