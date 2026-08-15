import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { findSpaceBySlug } from '../../space/server/queries';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import {
  getIntelligencePackCatalog,
  renderPackTemplateMarkdown,
  PACK_SEED_SOURCE_APP,
} from '../packs';
import {
  assertSafePackId,
  assertSafeSpaceSlug,
  frameworkPackManifestPath,
  frameworkPackOntologyPath,
  frameworkPackTemplatePath,
} from '../paths';
import {
  enablePackOnManifest,
  readSpaceIntelligenceManifest,
  writeSpaceIntelligenceManifest,
} from './manifest';
import {
  IntelligenceBlobNotConfiguredError,
  isIntelligenceBlobConfigured,
  putIntelligenceBlobText,
} from './blob-client';
import { seedIntelligenceArtifactIfMissing } from './write-intelligence';

export type EnableIntelligencePackInput = {
  spaceSlug: string;
  packId: string;
  /** When set, seed only this catalog template. Otherwise seed the full pack. */
  templateId?: string;
  authToken?: string;
};

export type EnableIntelligencePackResult =
  | {
      access: 'ok';
      space_slug: string;
      pack_id: string;
      enabled_packs: string[];
      seeded: string[];
      skipped: string[];
    }
  | {
      access: 'denied';
      message: string;
      space_slug: string;
    }
  | {
      access: 'misconfigured';
      message: string;
      space_slug: string;
    };

async function publishPackToBlob(packId: string): Promise<void> {
  const catalog = getIntelligencePackCatalog(packId);
  if (!catalog) return;

  await putIntelligenceBlobText({
    pathname: frameworkPackManifestPath(packId),
    body: `${JSON.stringify(
      {
        id: catalog.id,
        title: catalog.title,
        version: catalog.version,
        description: catalog.description,
        templates: catalog.templates.map((t) => t.id),
      },
      null,
      2,
    )}\n`,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
  });

  await putIntelligenceBlobText({
    pathname: frameworkPackOntologyPath(packId),
    body: catalog.ontology,
    allowOverwrite: true,
  });

  const today = new Date().toISOString().slice(0, 10);
  for (const template of catalog.templates) {
    const markdown = renderPackTemplateMarkdown({
      template,
      packId,
      spaceSlug: packId,
      today,
    });
    await putIntelligenceBlobText({
      pathname: frameworkPackTemplatePath({
        packId,
        artifactId: template.id,
      }),
      body: markdown,
      allowOverwrite: true,
    });
  }
}

export async function enableIntelligencePackForSpace(
  input: EnableIntelligencePackInput,
  { db }: { db: DatabaseInstance },
): Promise<EnableIntelligencePackResult> {
  const spaceSlug = assertSafeSpaceSlug(input.spaceSlug);
  const packId = assertSafePackId(input.packId);
  const catalog = getIntelligencePackCatalog(packId);
  if (!catalog) {
    return {
      access: 'denied',
      message: `Unknown intelligence pack "${packId}".`,
      space_slug: spaceSlug,
    };
  }

  if (!isIntelligenceBlobConfigured()) {
    return {
      access: 'misconfigured',
      message:
        'Space Intelligence storage is not configured (BLOB_READ_WRITE_TOKEN).',
      space_slug: spaceSlug,
    };
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      access: 'denied',
      message: `Space "${spaceSlug}" was not found.`,
      space_slug: spaceSlug,
    };
  }

  if (space.web3SpaceId != null) {
    if (!canConvertToBigInt(space.web3SpaceId)) {
      return {
        access: 'denied',
        message: `Space "${space.slug}" has an invalid on-chain space id.`,
        space_slug: spaceSlug,
      };
    }
    const gate = await checkSpaceAccessForSpace(space, input.authToken);
    if (!gate.hasAccess) {
      return {
        access: 'denied',
        message: gate.message,
        space_slug: spaceSlug,
      };
    }
  }

  try {
    await publishPackToBlob(packId);

    const templateId = input.templateId?.trim();
    const templates = templateId
      ? catalog.templates.filter((template) => template.id === templateId)
      : catalog.templates;
    if (templateId && templates.length === 0) {
      return {
        access: 'denied',
        message: `Unknown template "${templateId}" in pack "${packId}".`,
        space_slug: spaceSlug,
      };
    }

    const seeded: string[] = [];
    const skipped: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const template of templates) {
      const markdown = renderPackTemplateMarkdown({
        template,
        packId,
        spaceSlug,
        today,
      });
      const result = await seedIntelligenceArtifactIfMissing(
        {
          spaceSlug,
          markdown,
          authToken: input.authToken,
          canonicalSourceApp: PACK_SEED_SOURCE_APP,
        },
        { db },
      );
      if (result.access === 'denied' || result.access === 'misconfigured') {
        return result;
      }
      if (result.access === 'conflict') {
        skipped.push(template.id);
        continue;
      }
      if (result.created) seeded.push(template.id);
      else skipped.push(template.id);
    }

    const { manifest } = await readSpaceIntelligenceManifest(spaceSlug);
    const next = enablePackOnManifest(manifest, packId);
    await writeSpaceIntelligenceManifest({ spaceSlug, manifest: next });

    return {
      access: 'ok',
      space_slug: spaceSlug,
      pack_id: packId,
      enabled_packs: next.enabled_packs,
      seeded,
      skipped,
    };
  } catch (error) {
    if (error instanceof IntelligenceBlobNotConfiguredError) {
      return {
        access: 'misconfigured',
        message: error.message,
        space_slug: spaceSlug,
      };
    }
    throw error;
  }
}
