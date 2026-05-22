import {
  serializeOrgMemoryAssetKey,
  type OrgMemoryAssetKeyPayload,
} from './org-memory-asset-key';

/** Minimal shape for attaching stable fetch keys (matches org_memory_assets JSON). */
export type OrgMemoryAssetLike = {
  source:
    | 'proposal_upload'
    | 'memory'
    | 'matrix_chat'
    | 'call_recording'
    | 'call_transcript'
    | 'discussion_summary';
  app_url?: string;
  document_id?: number;
  matrix_room_id?: string;
  matrix_event_id?: string;
  mxc_uri?: string;
  call_session_id?: string;
  call_recording_id?: number;
  call_transcript_id?: number;
  discussion_summary_id?: number;
  text_excerpt?: string;
};

export function withOrgMemoryAssetKeys<T extends OrgMemoryAssetLike>(
  assets: T[],
): Array<T & { asset_key: string }> {
  return assets.map((a) => {
    let payload: OrgMemoryAssetKeyPayload;
    if (a.source === 'proposal_upload' && a.app_url && a.document_id != null) {
      payload = { k: 'p', d: a.document_id, u: a.app_url.trim() };
    } else if (a.source === 'memory' && a.document_id != null) {
      const url = a.app_url?.trim();
      payload = url
        ? { k: 'mem', d: a.document_id, u: url }
        : { k: 'mem', d: a.document_id };
    } else if (
      a.source === 'matrix_chat' &&
      a.matrix_room_id &&
      a.matrix_event_id &&
      a.mxc_uri
    ) {
      payload = {
        k: 'm',
        r: a.matrix_room_id,
        e: a.matrix_event_id,
        x: a.mxc_uri.trim(),
      };
    } else if (a.source === 'call_recording' && a.call_recording_id != null) {
      payload = { k: 'cr', i: a.call_recording_id };
    } else if (a.source === 'call_transcript' && a.call_transcript_id != null) {
      payload = { k: 'ct', i: a.call_transcript_id };
    } else if (
      a.source === 'discussion_summary' &&
      a.discussion_summary_id != null
    ) {
      payload = { k: 'ds', i: a.discussion_summary_id };
    } else if (
      a.source === 'call_recording' ||
      a.source === 'call_transcript' ||
      a.source === 'discussion_summary'
    ) {
      throw new Error(`Missing artifact id for source "${a.source}"`);
    } else {
      payload = { k: 'p', d: a.document_id ?? 0, u: a.app_url?.trim() ?? '' };
    }
    return { ...a, asset_key: serializeOrgMemoryAssetKey(payload) };
  });
}
