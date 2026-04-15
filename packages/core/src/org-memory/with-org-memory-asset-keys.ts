import {
  serializeOrgMemoryAssetKey,
  type OrgMemoryAssetKeyPayload,
} from './org-memory-asset-key';

/** Minimal shape for attaching stable fetch keys (matches org_memory_assets JSON). */
export type OrgMemoryAssetLike = {
  source: 'proposal_upload' | 'matrix_chat';
  app_url?: string;
  document_id?: number;
  matrix_room_id?: string;
  matrix_event_id?: string;
  mxc_uri?: string;
};

export function withOrgMemoryAssetKeys<T extends OrgMemoryAssetLike>(
  assets: T[],
): Array<T & { asset_key: string }> {
  return assets.map((a) => {
    let payload: OrgMemoryAssetKeyPayload;
    if (a.source === 'proposal_upload' && a.app_url && a.document_id != null) {
      payload = { k: 'p', d: a.document_id, u: a.app_url.trim() };
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
    } else {
      payload = { k: 'p', d: a.document_id ?? 0, u: a.app_url?.trim() ?? '' };
    }
    return { ...a, asset_key: serializeOrgMemoryAssetKey(payload) };
  });
}
