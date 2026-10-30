/** The on-chain proposal number when known, else the document id. */
export function agreementNumber(
  web3Id: number | null,
  documentId: number | null,
): string {
  if (web3Id != null) return String(web3Id);
  if (documentId != null) return String(documentId);
  return '—';
}
