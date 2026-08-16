import { describe, expect, it } from 'vitest';
import {
  IBA_CANNOT_APPROVE_PATCH,
  IBA_CANNOT_PUBLISH,
  IBA_CANNOT_SHA_UPDATE_ON_CREATE,
  ibaHttpCreateDenial,
  ibaPatchActionDenied,
  ibaWriteDeniesPublish,
} from '../iba-access';

describe('ibaWriteDeniesPublish', () => {
  it('blocks IBA keys from promoting a draft to current', () => {
    expect(
      ibaWriteDeniesPublish({
        skipMembershipCheck: true,
        promoteDraft: true,
      }),
    ).toBe(true);
  });

  it('lets members publish and lets IBAs create drafts', () => {
    expect(
      ibaWriteDeniesPublish({
        skipMembershipCheck: false,
        promoteDraft: true,
      }),
    ).toBe(false);
    expect(
      ibaWriteDeniesPublish({
        skipMembershipCheck: true,
        promoteDraft: false,
      }),
    ).toBe(false);
  });
});

describe('ibaHttpCreateDenial', () => {
  const keySource = 'stakeholder-protocol';

  it('rejects mode=publish', () => {
    expect(ibaHttpCreateDenial({ mode: 'publish', keySource })).toBe(
      IBA_CANNOT_PUBLISH,
    );
  });

  it('rejects expectedSha updates of published artifacts', () => {
    expect(ibaHttpCreateDenial({ expectedSha: 'abc123', keySource })).toBe(
      IBA_CANNOT_SHA_UPDATE_ON_CREATE,
    );
    expect(ibaHttpCreateDenial({ expected_sha: 'abc123', keySource })).toBe(
      IBA_CANNOT_SHA_UPDATE_ON_CREATE,
    );
  });

  it('rejects a spoofed source_app', () => {
    expect(
      ibaHttpCreateDenial({
        claimedSourceApp: 'hypha-mcp',
        keySource,
      }),
    ).toBe(
      `source_app "hypha-mcp" does not match authenticated app identity "${keySource}".`,
    );
  });

  it('allows a draft create that matches the key identity', () => {
    expect(
      ibaHttpCreateDenial({
        mode: 'draft',
        claimedSourceApp: keySource,
        keySource,
      }),
    ).toBeNull();
    expect(ibaHttpCreateDenial({ keySource })).toBeNull();
  });
});

describe('ibaPatchActionDenied', () => {
  it('allows propose and denies approve/reject', () => {
    expect(ibaPatchActionDenied(undefined)).toBeNull();
    expect(ibaPatchActionDenied('propose')).toBeNull();
    expect(ibaPatchActionDenied('approve')).toBe(IBA_CANNOT_APPROVE_PATCH);
    expect(ibaPatchActionDenied('reject')).toBe(IBA_CANNOT_APPROVE_PATCH);
  });
});
