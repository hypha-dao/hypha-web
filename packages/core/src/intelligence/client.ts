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
  IntelligenceCoreType,
  IntelligenceStatus,
  IntelligenceArtifact,
} from './types';
export { buildIntelligenceRelatedGraph } from './graph';
export type {
  IntelligenceGraph,
  IntelligenceGraphNode,
  IntelligenceGraphEdge,
} from './graph';
