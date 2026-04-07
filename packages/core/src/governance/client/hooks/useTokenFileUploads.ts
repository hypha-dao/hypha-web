'use client';

import { useImageUpload } from '@hypha-platform/core/client';
import React from 'react';
import { z } from 'zod';

export const schemaTokenFile = z.object({
  iconUrl: z
    .instanceof(File)
    .refine(
      (file) => file.size <= 4 * 1024 * 1024, // 4MB
      'File size must be less than 4 MB',
    )
    .refine(
      (file) =>
        ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
          file.type,
        ),
      'The file must be an image (JPEG, PNG, GIF, WEBP)',
    )
    .optional(),
});

type TokenFile = z.infer<typeof schemaTokenFile>;

export type UseTokenFileUploadsReturn = {
  isLoading: boolean;
  file: { iconUrl?: string } | null;
  upload: (fileInput: TokenFile) => Promise<{ iconUrl?: string }>;
};

export const useTokenFileUploads = (
  authToken?: string | null,
): UseTokenFileUploadsReturn => {
  const [file, setFile] = React.useState<{ iconUrl?: string } | null>(null);
  const { upload, isUploading } = useImageUpload({
    authorizationToken: authToken ?? undefined,
  });

  const handleUpload = React.useCallback(
    async (fileInput: TokenFile): Promise<{ iconUrl?: string }> => {
      if (!fileInput.iconUrl) {
        setFile(null);
        return { iconUrl: undefined };
      }

      try {
        const result = await upload([fileInput.iconUrl]);
        if (result?.[0]?.ufsUrl) {
          const uploadedUrl = result[0].ufsUrl;
          setFile({ iconUrl: uploadedUrl });
          return { iconUrl: uploadedUrl };
        } else {
          throw new Error('Failed to get URL of uploaded file');
        }
      } catch (error) {
        console.error('Error loading token icon:', error);
        throw error;
      }
    },
    [upload],
  );

  return {
    isLoading: isUploading,
    file,
    upload: handleUpload,
  };
};
