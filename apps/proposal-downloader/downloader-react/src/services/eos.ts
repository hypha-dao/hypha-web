import { JsonRpc } from 'eosjs';

const rpc = new JsonRpc('https://mainnet.telos.net');
const contract = 'dao.hypha';

export interface Dao {
  id: string; // Numeric ID as string for API calls
  name: string; // Human-readable display name
  daoName: string; // Original DAO name from blockchain
}

export interface Proposal {
  id: string;
  creator: string;
  created_date: string;
  content_groups: any[]; // Define a more specific type if possible
}

export const getDaos = async (): Promise<Dao[]> => {
  try {
    const response = await fetch('/dao-names.json');
    const daos: Dao[] = await response.json();
    return daos;
  } catch (error) {
    console.error('Error fetching DAOs:', error);
    return [];
  }
};

// Definitive list of proposal types from proposal_factory.cpp and common.hpp
const proposalTypes = new Set([
  'badge',
  'assignbadge',
  'role',
  'assignment',
  'payout',
  'attestation',
  'suspend',
  'edit',
  'queststart',
  'questcompl',
  'policy',
  'poll',
  'circle',
  'budget',
  'extension',
]);

export const getProposalsForDao = async (
  daoId: string,
  onProgress: (progress: {
    proposals: number;
    batches: number;
    totalBatches: number;
  }) => void,
  signal: AbortSignal,
): Promise<Proposal[]> => {
  try {
    console.log(
      `Starting direct scan of 'documents' table for DAO ID: ${daoId}`,
    );

    const numericDaoId = parseInt(daoId, 10);
    const proposals: Proposal[] = [];
    let lower_bound: string | null = null;
    let more = true;
    let batch = 0;
    const maxBatches = 500; // High limit to scan the whole table

    while (more && batch < maxBatches) {
      if (signal.aborted) {
        console.log('Download cancelled by user.');
        break;
      }
      batch++;
      const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'documents',
        lower_bound,
        limit: 500, // Process in manageable chunks
      });

      for (const doc of result.rows) {
        if (!doc.content_groups) continue;

        let docDaoId = null;
        let docType = null;

        for (const group of doc.content_groups) {
          for (const content of group) {
            if (content.label === 'dao') {
              docDaoId = content.value[1];
            } else if (content.label === 'type') {
              docType = content.value[1];
            }
          }
        }

        if (docDaoId === numericDaoId && proposalTypes.has(docType)) {
          proposals.push(doc);
        }
      }

      onProgress({
        proposals: proposals.length,
        batches: batch,
        totalBatches: maxBatches,
      });
      if (batch % 10 === 0) {
        console.log(
          `  Batch ${batch}: Total proposals found so far: ${proposals.length}`,
        );
      }

      more = result.more;
      if (more) {
        lower_bound = result.next_key;
      } else {
        console.log(`  Finished scan after batch ${batch}.`);
        break;
      }

      await new Promise((r) => setTimeout(r, 50)); // Small delay
    }

    console.log(`✅ Final Proposal Count for Hypha DAO: ${proposals.length}`);
    onProgress({
      proposals: proposals.length,
      batches: batch,
      totalBatches: maxBatches,
    });
    return proposals;
  } catch (error) {
    console.error(`Error fetching proposals for DAO ${daoId}:`, error);
    return [];
  }
};

const getDocument = async (docId: string): Promise<Proposal | null> => {
  try {
    const result = await rpc.get_table_rows({
      json: true,
      code: contract,
      scope: contract,
      table: 'documents',
      lower_bound: docId,
      upper_bound: docId,
      limit: 1,
    });

    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching document ${docId}:`, error);
    return null;
  }
};
