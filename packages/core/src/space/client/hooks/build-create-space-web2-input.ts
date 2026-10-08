import { z } from 'zod';

import {
  schemaCreateSpaceFiles,
  schemaCreateSpaceWeb2,
} from '../../validation';

type SpaceFileFields = z.infer<typeof schemaCreateSpaceFiles>;

export type CreateSpaceUploadedFileUrls = {
  logoUrl?: string;
  leadImage?: string;
  ecosystemLogoUrlLight?: string;
  ecosystemLogoUrlDark?: string;
};

/**
 * Drop File objects before web2 parse — `schemaCreateSpaceWeb2` expects URL
 * strings for ecosystem logos. Logo/lead URLs are attached after parse.
 */
export function buildCreateSpaceWeb2Input(
  arg: Record<string, unknown> & SpaceFileFields,
  uploadedFileUrls: CreateSpaceUploadedFileUrls,
  web3: { spaceId: number; executor: string },
) {
  const {
    logoUrl: _logoUrl,
    leadImage: _leadImage,
    ecosystemLogoUrlLight: _ecosystemLogoUrlLight,
    ecosystemLogoUrlDark: _ecosystemLogoUrlDark,
    ...web2Fields
  } = arg;

  return schemaCreateSpaceWeb2.parse({
    ...web2Fields,
    web3SpaceId: web3.spaceId,
    address: web3.executor,
    ecosystemLogoUrlLight: uploadedFileUrls.ecosystemLogoUrlLight,
    ecosystemLogoUrlDark: uploadedFileUrls.ecosystemLogoUrlDark,
  });
}
