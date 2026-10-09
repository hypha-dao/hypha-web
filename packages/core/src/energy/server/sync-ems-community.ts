import 'server-only';

import { Client } from 'pg';
import { parseEventLogs } from 'viem';

import type { DbConfig } from '../../common/server/types';
import { web3Client } from '../../common/server/web3-rpc/client';
import { findDocumentWithSpaceByIdRaw } from '../../governance/server/queries';
import { energyPpaV2FactoryAbi } from '../client/contracts';
import {
  readEnergyCommunitySetup,
  type EnergyCommunitySetup,
} from '../community-profile';
import { getEnergyDbConfigFromEnv } from './azure-db-config';

export type SyncEnergyCommunityInput = {
  proposalId: number;
  transactionHash?: `0x${string}` | null;
};

export type SyncEnergyCommunityResult =
  | {
      status: 'synced';
      vppCommunityId: number;
      factoryCommunityId: number;
    }
  | {
      status: 'skipped';
      reason:
        | 'not-energy-community-setup'
        | 'energy-db-not-configured'
        | 'no-transaction-hash'
        | 'no-community-deployed'
        | 'community-id-out-of-range';
    };

const communityName = (title: string | null | undefined): string => {
  const trimmed = title?.trim();
  if (!trimmed) return 'Energy Community';
  return trimmed.slice(0, 200);
};

const readFactoryCommunityId = async (
  transactionHash: `0x${string}`,
): Promise<number | null> => {
  const receipt = await web3Client.getTransactionReceipt({
    hash: transactionHash,
  });
  const logs = parseEventLogs({
    abi: energyPpaV2FactoryAbi,
    logs: receipt.logs,
    strict: false,
  });
  const deployed = logs.find((log) => log.eventName === 'CommunityDeployed');
  if (!deployed) return null;

  const communityId = (deployed.args as { communityId?: bigint }).communityId;
  if (communityId === undefined) return null;
  if (communityId > BigInt(Number.MAX_SAFE_INTEGER) || communityId < 0n) {
    return Number.NaN;
  }
  return Number(communityId);
};

const COMMUNITY_WRITE_SQL = {
  update: `
    UPDATE mgmt.communities
    SET
      name = $2,
      address = $3,
      time_zone = $4,
      default_ems_objective = $5,
      latitude = $6,
      longitude = $7,
      city = $8,
      region = $9,
      postal_code = $10,
      country_id = (SELECT id FROM mgmt.countries WHERE iso_code = $11),
      updated_at = now()
    WHERE factory_community_id = $1
    RETURNING id
  `,
  insert: `
    INSERT INTO mgmt.communities (
      id,
      name,
      address,
      time_zone,
      pricing_currency,
      default_ems_objective,
      factory_community_id,
      latitude,
      longitude,
      city,
      region,
      postal_code,
      country_id
    )
    VALUES (
      nextval('mgmt.communities_id_seq'),
      $2,
      $3,
      $4,
      COALESCE(
        (SELECT currency FROM mgmt.countries WHERE iso_code = $11),
        'EUR'
      ),
      $5,
      $1,
      $6,
      $7,
      $8,
      $9,
      $10,
      (SELECT id FROM mgmt.countries WHERE iso_code = $11)
    )
    RETURNING id
  `,
};

const upsertCommunity = async (
  client: Client,
  input: {
    name: string;
    factoryCommunityId: number;
    setup: EnergyCommunitySetup;
  },
): Promise<number> => {
  const values = [
    input.factoryCommunityId,
    input.name,
    input.setup.address,
    input.setup.timeZone,
    input.setup.emsObjective,
    input.setup.latitude,
    input.setup.longitude,
    input.setup.city,
    input.setup.region,
    input.setup.postalCode,
    input.setup.countryIso,
  ];

  const updated = await client.query<{ id: number }>(
    COMMUNITY_WRITE_SQL.update,
    values,
  );
  if (updated.rows[0]) return updated.rows[0].id;

  try {
    const inserted = await client.query<{ id: number }>(
      COMMUNITY_WRITE_SQL.insert,
      values,
    );
    const insertedRow = inserted.rows[0];
    if (!insertedRow) {
      throw new Error('Energy community insert did not return an id');
    }
    return insertedRow.id;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== '23505') throw error;
    const raced = await client.query<{ id: number }>(
      COMMUNITY_WRITE_SQL.update,
      values,
    );
    const racedRow = raced.rows[0];
    if (!racedRow) {
      throw error;
    }
    return racedRow.id;
  }
};

/**
 * After an Enable Energy Community proposal executes, copy the agreed
 * objective and location onto Zek's `mgmt.communities` row, keyed by the
 * on-chain factory community id.
 */
export const syncEnergyCommunitySetupForProposal = async (
  { proposalId, transactionHash }: SyncEnergyCommunityInput,
  { db }: DbConfig,
): Promise<SyncEnergyCommunityResult> => {
  const row = await findDocumentWithSpaceByIdRaw({ id: proposalId }, { db });
  const setup = readEnergyCommunitySetup(row?.document.description);
  if (!setup) {
    return { status: 'skipped', reason: 'not-energy-community-setup' };
  }

  const dbConfig = getEnergyDbConfigFromEnv();
  if (!dbConfig) {
    return { status: 'skipped', reason: 'energy-db-not-configured' };
  }
  if (!transactionHash) {
    return { status: 'skipped', reason: 'no-transaction-hash' };
  }

  const factoryCommunityId = await readFactoryCommunityId(transactionHash);
  if (factoryCommunityId === null) {
    return { status: 'skipped', reason: 'no-community-deployed' };
  }
  if (!Number.isInteger(factoryCommunityId)) {
    return { status: 'skipped', reason: 'community-id-out-of-range' };
  }

  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
    query_timeout: 20_000,
  });

  await client.connect();
  try {
    const vppCommunityId = await upsertCommunity(client, {
      name: communityName(row?.space.title),
      factoryCommunityId,
      setup,
    });
    return {
      status: 'synced',
      vppCommunityId,
      factoryCommunityId,
    };
  } finally {
    await client.end();
  }
};
