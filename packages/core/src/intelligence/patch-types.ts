export type IntelligencePatchStatus = 'pending' | 'approved' | 'rejected';

/**
 * Pending (or resolved) proposal to publish a new intelligence version,
 * keyed by Coherence signal slug and stored under `_patches/` in the bucket.
 */
export type IntelligenceArtifactPatch = {
  status: IntelligencePatchStatus;
  space: string;
  signal_slug: string;
  target_id: string;
  /** SHA of the live artifact the proposal was based on. */
  expected_sha: string;
  source_app: string;
  title: string;
  created_at: string;
  updated_at: string;
  /** Full proposed markdown (frontmatter + body) for the next published version. */
  markdown: string;
};
