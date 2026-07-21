import type { HighlightsBlock, HighlightsSupportAction } from './types';

export type PublishValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

function blockHasContent(block: HighlightsBlock | undefined): boolean {
  if (!block || !block.visible) return false;
  const body = block.body?.trim() ?? '';
  const items = block.items?.length ?? 0;
  return body.length > 0 || items > 0;
}

export function validateHighlightProfileForPublish(input: {
  blocks: HighlightsBlock[];
  supportActions: HighlightsSupportAction[];
  discoverability?: number | null;
}): PublishValidationResult {
  const errors: string[] = [];

  // SpaceTransparencyLevel.NETWORK = 1, PUBLIC = 0 — require ≤ NETWORK (0 or 1)
  if (
    input.discoverability != null &&
    input.discoverability > 1 /* NETWORK */
  ) {
    errors.push(
      'Space discoverability must be Network or Public to publish on Marketplace',
    );
  }

  const about = input.blocks.find((b) => b.type === 'about');
  const needs = input.blocks.find((b) => b.type === 'needs');
  if (!blockHasContent(about)) {
    errors.push('About section must be filled before publishing');
  }
  if (!blockHasContent(needs)) {
    errors.push('Needs section must be filled before publishing');
  }

  const hasEnabledCta = input.supportActions.some((a) => a.enabled);
  if (!hasEnabledCta) {
    errors.push('At least one support action must be enabled');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
