/**
 * Client-safe Space Intelligence surface (no Node/yaml parse stack).
 * Server I/O lives under `./server`; markdown parse under `./parse-markdown`.
 */
export {
  INTELLIGENCE_CORE_TYPES,
  INTELLIGENCE_STATUSES,
  INTELLIGENCE_TYPE_FOLDERS,
} from './types';
export type {
  IntelligenceFrontmatter,
  IntelligenceManifest,
  IntelligenceManifestEntry,
  IntelligenceListItem,
  IntelligenceCoreType,
  IntelligenceStatus,
  IntelligenceArtifact,
} from './types';
export type {
  IntelligenceArtifactPatch,
  IntelligencePatchStatus,
} from './patch-types';
export {
  buildIntelligenceRelatedGraph,
  buildIntelligenceSignalGraph,
  extractLinkedSignalSlug,
  intelligenceDocumentationNodeId,
  intelligenceSignalNodeId,
  intelligenceSignalSlugFromNodeId,
} from './graph';
export { HYPHA_ENERGY_PACK_ID } from './packs/ids';
export { excerptIntelligenceBody } from './excerpt';
export {
  resolveCanonicalSourceApp,
  INTELLIGENCE_MARKDOWN_MAX_BYTES,
} from './app-identity';
export type { ResolveCanonicalSourceAppResult } from './app-identity';
export type {
  IntelligenceGraph,
  IntelligenceGraphNode,
  IntelligenceGraphEdge,
} from './graph';
export {
  SIGNAL_SUNBURST_UNCATEGORIZED_ID,
  SUNBURST_BOARD_PALETTE,
  buildIntelligenceSunburstTree,
  resolveSunburstBoard,
  sunburstBoardColor,
} from './sunburst';
export type {
  IntelligenceSunburstKind,
  IntelligenceSunburstNode,
  SunburstArtifactInput,
  SunburstBoardInput,
  SunburstFileInput,
  SunburstSignalInput,
} from './sunburst';
