import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { extractCustomerMissingFlags } from '../bridge-customer-endorsements';
import type { BridgeCustomerEndorsement } from '../../../common/server/bridge-client';

function makeEndorsement(allOf: unknown[]): BridgeCustomerEndorsement {
  return {
    name: 'base',
    status: 'incomplete',
    requirements: { missing: { all_of: allOf as never } },
  };
}

describe('extractCustomerMissingFlags', () => {
  it('returns no flags for empty endorsements', () => {
    expect(extractCustomerMissingFlags([], [])).toEqual({
      sofMissing: false,
      pendingUbos: [],
    });
  });

  it('returns no flags when requirements.missing is null', () => {
    const endorsement: BridgeCustomerEndorsement = {
      name: 'base',
      status: 'approved',
      requirements: { missing: null },
    };
    expect(extractCustomerMissingFlags([endorsement], [])).toEqual({
      sofMissing: false,
      pendingUbos: [],
    });
  });

  it('detects source_of_funds_questionnaire in missing.all_of', () => {
    const { sofMissing } = extractCustomerMissingFlags(
      [makeEndorsement(['source_of_funds_questionnaire'])],
      [],
    );
    expect(sofMissing).toBe(true);
  });

  it('detects minimal_source_of_funds_data in missing.all_of', () => {
    const { sofMissing } = extractCustomerMissingFlags(
      [makeEndorsement(['minimal_source_of_funds_data'])],
      [],
    );
    expect(sofMissing).toBe(true);
  });

  it('does not set sofMissing for unrelated missing items', () => {
    const { sofMissing } = extractCustomerMissingFlags(
      [makeEndorsement(['tax_identification_number', 'kyb_review'])],
      [],
    );
    expect(sofMissing).toBe(false);
  });

  it('collects UBO IDs from associated_person objects in missing.all_of', () => {
    const uboItem = {
      object_type: 'associated_person',
      object_id: 'ubo-id-1',
      all_of: ['government_id_document'],
    };
    const { pendingUbos } = extractCustomerMissingFlags(
      [makeEndorsement([uboItem])],
      [{ id: 'ubo-id-1', email: 'ubo@example.com' }],
    );
    expect(pendingUbos).toEqual([{ id: 'ubo-id-1', email: 'ubo@example.com' }]);
  });

  it('sets email to null when the UBO is not in associated_persons', () => {
    const uboItem = {
      object_type: 'associated_person',
      object_id: 'ubo-unknown',
      all_of: ['government_id_document'],
    };
    const { pendingUbos } = extractCustomerMissingFlags(
      [makeEndorsement([uboItem])],
      [],
    );
    expect(pendingUbos).toEqual([{ id: 'ubo-unknown', email: null }]);
  });

  it('deduplicates UBO IDs that appear across multiple endorsements', () => {
    const uboItem = {
      object_type: 'associated_person',
      object_id: 'ubo-shared',
      all_of: ['tax_identification_number'],
    };
    const base = makeEndorsement([uboItem]);
    const sepa = { ...base, name: 'sepa' };
    const { pendingUbos } = extractCustomerMissingFlags([base, sepa], []);
    expect(pendingUbos).toHaveLength(1);
    expect(pendingUbos[0]?.id).toBe('ubo-shared');
  });

  it('handles both sofMissing and UBOs in the same endorsement', () => {
    const uboItem = {
      object_type: 'associated_person',
      object_id: 'ubo-id-2',
      all_of: ['government_id_document'],
    };
    const result = extractCustomerMissingFlags(
      [makeEndorsement(['source_of_funds_questionnaire', uboItem])],
      [{ id: 'ubo-id-2', email: 'a@b.com' }],
    );
    expect(result.sofMissing).toBe(true);
    expect(result.pendingUbos).toHaveLength(1);
  });

  it('handles null/undefined endorsements gracefully', () => {
    expect(extractCustomerMissingFlags(null, null)).toEqual({
      sofMissing: false,
      pendingUbos: [],
    });
    expect(extractCustomerMissingFlags(undefined, undefined)).toEqual({
      sofMissing: false,
      pendingUbos: [],
    });
  });
});
