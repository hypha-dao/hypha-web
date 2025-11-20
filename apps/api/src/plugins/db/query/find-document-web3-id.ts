import { eq } from 'drizzle-orm';
import { schema, documents } from '../schema';
import type { DbConfig } from './type';

export async function findDocumentWeb3Id(
  { id }: { id: number },
  { db }: DbConfig<typeof schema>,
) {
  const [res] = await db
    .select({
      web3Id: documents.web3ProposalId,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  return res?.web3Id || null;
}
