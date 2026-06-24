import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_INLINE_ATTACHMENT_MAX_BYTES,
  ChatAttachmentTooLargeError,
  uploadChatAttachmentFile,
} from '@hypha-platform/core/client';

export type FilePart = {
  type: 'file';
  mediaType: string;
  url: string;
};

export type ConvertFilesToPartsOptions = {
  authorizationToken?: string;
};

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Could not read "${file.name}"`));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error(`Could not read "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

async function convertFileToPart(
  file: File,
  authorizationToken?: string,
): Promise<FilePart> {
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new ChatAttachmentTooLargeError(file.name);
  }

  const token = authorizationToken?.trim();
  if (token) {
    const uploaded = await uploadChatAttachmentFile(file, token);
    return {
      type: 'file',
      mediaType: uploaded.mediaType,
      url: uploaded.url,
    };
  }

  if (file.size > CHAT_INLINE_ATTACHMENT_MAX_BYTES) {
    throw new ChatAttachmentTooLargeError(file.name);
  }

  return {
    type: 'file',
    mediaType: file.type || 'application/octet-stream',
    url: await readFileAsDataUrl(file),
  };
}

export async function convertFilesToParts(
  files: File[],
  options?: ConvertFilesToPartsOptions,
): Promise<FilePart[]> {
  return Promise.all(
    files.map((file) => convertFileToPart(file, options?.authorizationToken)),
  );
}

export { ChatAttachmentTooLargeError };
