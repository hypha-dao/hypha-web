import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findSpace,
  findDocument,
  findAllEvents,
  getSpacesByWeb3Ids,
  getSpacesBySlugs,
  getAllSpaces,
  findDocumentBySlug,
  findPeopleByWeb3Addresses,
  findPersonBySlug,
  findPersonByWeb3Address,
  readContract,
} = vi.hoisted(() => ({
  findSpace: vi.fn(),
  findDocument: vi.fn(),
  findAllEvents: vi.fn(),
  getSpacesByWeb3Ids: vi.fn(),
  getSpacesBySlugs: vi.fn(),
  getAllSpaces: vi.fn(),
  findDocumentBySlug: vi.fn(),
  findPeopleByWeb3Addresses: vi.fn(),
  findPersonBySlug: vi.fn(),
  findPersonByWeb3Address: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock('@hypha-platform/storage-postgres', () => ({
  db: {
    query: {
      spaces: { findFirst: findSpace },
      documents: { findFirst: findDocument },
    },
  },
}));
vi.mock('@hypha-platform/core/server', () => ({
  findAllEvents,
  getSpacesByWeb3Ids,
  getSpacesBySlugs,
  getAllSpaces,
  findDocumentBySlug,
  findPeopleByWeb3Addresses,
  findPersonBySlug,
  findPersonByWeb3Address,
}));
vi.mock('@hypha-platform/core/client', () => ({
  EVENT_ENTITY_TYPES: ['person', 'space', 'document', 'token'],
  getProposalVoters: (args: unknown) => args,
  isMember: (args: unknown) => args,
  publicClient: { readContract },
}));

import { NextRequest } from 'next/server';
import { GET as getEvents } from '../../../app/api/v1/events/route';
import { GET as getSpaces } from '../../../app/api/v1/spaces/route';
import { GET as getDocument } from '../../../app/api/v1/documents/[documentSlug]/route';
import { GET as getVoters } from '../../../app/api/v1/documents/[documentSlug]/voters/route';
import { GET as getPerson } from '../../../app/api/v1/people/[personSlug]/route';
import { GET as getPersonByAddress } from '../../../app/api/v1/people/by-web3-address/[address]/route';
import { resetMappedHostScopeCache } from '../mapped-host-scope';
import { WL_SPACE_HEADER } from '../constants';

const OWN = { id: 7, web3SpaceId: 42 };
/** `mapped` adds the header middleware sets on a mapped host. */
const request = (path: string, mapped: boolean) =>
  new NextRequest(`https://app.example${path}`, {
    headers: mapped ? { [WL_SPACE_HEADER]: 'own-space' } : {},
  });

beforeEach(() => {
  resetMappedHostScopeCache();
  vi.clearAllMocks();
  findSpace.mockResolvedValue(OWN);
  findAllEvents.mockResolvedValue([{ id: 1 }]);
  getSpacesByWeb3Ids.mockResolvedValue([{ id: 7 }]);
  getSpacesBySlugs.mockResolvedValue([{ id: 7 }]);
  getAllSpaces.mockResolvedValue([{ id: 7 }, { id: 8 }]);
});

describe('GET /api/v1/spaces', () => {
  const get = (query: string, mapped = true) =>
    getSpaces(request(`/api/v1/spaces${query}`, mapped));

  it('mapped: own web3 id or own slug is served', async () => {
    expect((await get('?web3SpaceIds=42')).status).toBe(200);
    expect(getSpacesByWeb3Ids).toHaveBeenCalledWith([42], undefined);
    expect((await get('?slugs=own-space')).status).toBe(200);
    expect((await get('?web3SpaceIds=42,42')).status).toBe(200);
  });

  it('mapped: another Space, or a list that includes one, is 404 and nothing is read', async () => {
    for (const q of [
      '?web3SpaceIds=43',
      '?web3SpaceIds=42,43',
      '?web3SpaceIds=42,abc',
      '?slugs=other',
      '?slugs=own-space,other',
      '?web3SpaceIds=42&slugs=other',
      '?web3SpaceIds=43&slugs=own-space',
    ]) {
      expect((await get(q)).status, q).toBe(404);
    }
    expect(getSpacesByWeb3Ids).not.toHaveBeenCalled();
    expect(getSpacesBySlugs).not.toHaveBeenCalled();
  });

  it('mapped: a row that only shares the on-chain id is dropped from the answer', async () => {
    getSpacesByWeb3Ids.mockResolvedValue([{ id: 7 }, { id: 99 }]);
    const res = await get('?web3SpaceIds=42');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 7 }]);
  });

  it('mapped: no filter, parentOnly and empty lists are 404', async () => {
    for (const q of [
      '',
      '?parentOnly=true',
      '?parentOnly=false',
      '?web3SpaceIds=',
      '?slugs=',
      '?slugs=,',
    ]) {
      expect((await get(q)).status, q).toBe(404);
    }
    expect(getAllSpaces).not.toHaveBeenCalled();
  });

  it('mapped: a Space without an on-chain id cannot be named by id', async () => {
    findSpace.mockResolvedValue({ id: 7, web3SpaceId: null });
    expect((await get('?web3SpaceIds=0')).status).toBe(404);
    expect((await get('?slugs=own-space')).status).toBe(200);
  });

  it('mapped: an unknown host Space is 404', async () => {
    findSpace.mockResolvedValue(null);
    expect((await get('?slugs=own-space')).status).toBe(404);
  });

  it('main app (no header): unchanged, including the no-filter call', async () => {
    const all = await get('', false);
    expect(all.status).toBe(200);
    expect(await all.json()).toEqual([{ id: 7 }, { id: 8 }]);
    expect(getAllSpaces).toHaveBeenCalledWith({ parentOnly: undefined });
    expect((await get('?parentOnly=true', false)).status).toBe(200);
    expect((await get('?web3SpaceIds=43,44', false)).status).toBe(200);
    expect(getSpacesByWeb3Ids).toHaveBeenCalledWith([43, 44], undefined);
    expect((await get('?slugs=other', false)).status).toBe(200);
    expect(findSpace).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/events', () => {
  const get = (query: string, mapped = true) =>
    getEvents(request(`/api/v1/events${query}`, mapped));

  it('mapped: space events of the own DB id are served', async () => {
    const res = await get(
      '?referenceEntity=space&referenceId=7&type=joinSpace',
    );
    expect(res.status).toBe(200);
    expect(findAllEvents).toHaveBeenCalledWith(expect.anything(), {
      type: 'joinSpace',
      referenceId: 7,
      referenceEntity: 'space',
    });
  });

  it('mapped: space events of another Space are 404', async () => {
    expect((await get('?referenceEntity=space&referenceId=8')).status).toBe(
      404,
    );
    expect(findAllEvents).not.toHaveBeenCalled();
  });

  it('mapped: document events need documents.spaceId to be the own Space', async () => {
    findDocument.mockResolvedValue({ spaceId: 7, web3ProposalId: 5 });
    expect(
      (await get('?referenceEntity=document&referenceId=100')).status,
    ).toBe(200);
    findDocument.mockResolvedValue({ spaceId: 8, web3ProposalId: 5 });
    expect(
      (await get('?referenceEntity=document&referenceId=101')).status,
    ).toBe(404);
    findDocument.mockResolvedValue(undefined);
    expect(
      (await get('?referenceEntity=document&referenceId=102')).status,
    ).toBe(404);
    expect(findAllEvents).toHaveBeenCalledTimes(1);
  });

  it('mapped: person and token events are refused', async () => {
    expect((await get('?referenceEntity=person&referenceId=7')).status).toBe(
      404,
    );
    expect((await get('?referenceEntity=token&referenceId=7')).status).toBe(
      404,
    );
    expect(findAllEvents).not.toHaveBeenCalled();
  });

  it('mapped: both references are required and must be valid, else 400', async () => {
    for (const q of [
      '',
      '?type=joinSpace',
      '?referenceEntity=space',
      '?referenceId=7',
      '?referenceEntity=space&referenceId=abc',
      '?referenceEntity=space&referenceId=7abc',
      '?referenceEntity=space&referenceId=-1',
      '?referenceEntity=space&referenceId=1.5',
      '?referenceEntity=nonsense&referenceId=7',
    ]) {
      expect((await get(q)).status, q).toBe(400);
    }
    expect(findAllEvents).not.toHaveBeenCalled();
  });

  it('mapped: an unknown host Space is 404 even when parameters are missing', async () => {
    findSpace.mockResolvedValue(undefined);
    expect((await get('')).status).toBe(404);
    expect((await get('?referenceEntity=space&referenceId=7')).status).toBe(
      404,
    );
    expect(findAllEvents).not.toHaveBeenCalled();
  });

  it('main app (no header): unchanged, including the no-filter call and NaN', async () => {
    expect((await get('', false)).status).toBe(200);
    expect(findAllEvents).toHaveBeenLastCalledWith(expect.anything(), {
      type: undefined,
      referenceId: undefined,
      referenceEntity: undefined,
    });
    expect(
      (await get('?referenceEntity=person&referenceId=abc', false)).status,
    ).toBe(200);
    expect(findAllEvents).toHaveBeenLastCalledWith(expect.anything(), {
      type: undefined,
      referenceId: NaN,
      referenceEntity: 'person',
    });
    expect(findSpace).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/documents/:documentSlug/voters', () => {
  const get = (mapped = true) =>
    getVoters(request('/api/v1/documents/doc-1/voters', mapped), {
      params: Promise.resolve({ documentSlug: 'doc-1' }),
    });

  beforeEach(() => {
    findDocumentBySlug.mockResolvedValue({ web3ProposalId: 5 });
    readContract.mockResolvedValue([['0xaaa'], ['0xbbb']]);
    findPeopleByWeb3Addresses.mockResolvedValue([
      { id: 1, name: 'A', surname: 'B', avatarUrl: null, address: '0xaaa' },
    ]);
  });

  it('mapped: a proposal of the own Space is read from the row that passed the check', async () => {
    findDocument.mockResolvedValue({ spaceId: 7, web3ProposalId: 11 });
    // The generic lookup would give another proposal id: it must not be used.
    findDocumentBySlug.mockResolvedValue({ web3ProposalId: 99 });
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).voters).toHaveLength(1);
    expect(findDocument.mock.calls[0]?.[0].columns).toEqual({
      id: true,
      spaceId: true,
      web3ProposalId: true,
    });
    expect(findDocumentBySlug).not.toHaveBeenCalled();
    expect(readContract).toHaveBeenCalledWith({ proposalId: 11n });
  });

  it('mapped: a proposal of another Space, or an unknown one, is 404 before the chain is read', async () => {
    findDocument.mockResolvedValue({ spaceId: 8, web3ProposalId: 11 });
    expect((await get()).status).toBe(404);
    findDocument.mockResolvedValue(undefined);
    expect((await get()).status).toBe(404);
    expect(readContract).not.toHaveBeenCalled();
    expect(findPeopleByWeb3Addresses).not.toHaveBeenCalled();
  });

  it('mapped: a document without a proposal id is 404', async () => {
    findDocument.mockResolvedValue({ spaceId: 7, web3ProposalId: null });
    expect((await get()).status).toBe(404);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('mapped: an unknown host Space is 404', async () => {
    findSpace.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it('main app (no header): unchanged, no extra lookups', async () => {
    const res = await get(false);
    expect(res.status).toBe(200);
    expect(findDocumentBySlug).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith({ proposalId: 5n });
    expect(findDocument).not.toHaveBeenCalled();
    expect(findSpace).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/documents/:documentSlug', () => {
  const get = (mapped = true, slug = 'doc-1') =>
    getDocument(request(`/api/v1/documents/${slug}`, mapped), {
      params: Promise.resolve({ documentSlug: slug }),
    });
  const DOC = { id: 3, title: 'T', creator: { name: 'A' } };

  it('mapped: a document of the own Space is returned, and it is the row that passed the check', async () => {
    findDocument.mockResolvedValue({ id: 3, spaceId: 7, web3ProposalId: 11 });
    findDocumentBySlug.mockResolvedValue(DOC);
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(DOC);
    expect(findDocument.mock.calls[0]?.[0].columns).toEqual({
      id: true,
      spaceId: true,
      web3ProposalId: true,
    });
  });

  it('mapped: a document of another Space, or an unknown one, is 404 and is not read in full', async () => {
    findDocument.mockResolvedValue({ id: 3, spaceId: 8, web3ProposalId: 11 });
    expect((await get()).status).toBe(404);
    findDocument.mockResolvedValue(undefined);
    expect((await get()).status).toBe(404);
    expect(findDocumentBySlug).not.toHaveBeenCalled();
  });

  it('mapped: a different row between the two lookups is 404', async () => {
    findDocument.mockResolvedValue({ id: 3, spaceId: 7, web3ProposalId: 11 });
    findDocumentBySlug.mockResolvedValue({ ...DOC, id: 4 });
    expect((await get()).status).toBe(404);
    findDocumentBySlug.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it('mapped: an unknown host Space is 404', async () => {
    findSpace.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it('main app (no header, or a forged-looking request without it): unchanged, any document, no scope lookups', async () => {
    findDocumentBySlug.mockResolvedValue(DOC);
    const res = await get(false);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(DOC);
    expect(findDocument).not.toHaveBeenCalled();
    expect(findSpace).not.toHaveBeenCalled();
  });

  it('main app: a missing document is null, as before', async () => {
    findDocumentBySlug.mockResolvedValue(null);
    const res = await get(false);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe('people routes on a mapped host', () => {
  const ADDR = '0x' + 'a'.repeat(40);
  const PERSON = {
    id: 5,
    slug: 'jane',
    name: 'Jane',
    address: ADDR,
    email: 'jane@example.org',
    sub: 'did:privy:1',
  };
  const bySlug = (mapped = true, slug = 'jane') =>
    getPerson(request(`/api/v1/people/${slug}`, mapped), {
      params: Promise.resolve({ personSlug: slug }),
    });
  const byAddress = (mapped = true, address = ADDR) =>
    getPersonByAddress(
      request(`/api/v1/people/by-web3-address/${address}`, mapped),
      { params: Promise.resolve({ address }) },
    );

  beforeEach(() => {
    findPersonBySlug.mockResolvedValue(PERSON);
    findPersonByWeb3Address.mockResolvedValue(PERSON);
    readContract.mockResolvedValue(true);
  });

  for (const [name, call] of [
    ['people/:personSlug', bySlug],
    ['people/by-web3-address/:address', byAddress],
  ] as const) {
    describe(name, () => {
      it('mapped: a member of the own Space is returned without email and sub', async () => {
        const res = await call();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({
          id: 5,
          slug: 'jane',
          name: 'Jane',
          address: ADDR,
        });
        expect('email' in body).toBe(false);
        expect('sub' in body).toBe(false);
        // The membership read is on-chain, for the host's own on-chain id.
        expect(readContract).toHaveBeenCalledWith({
          spaceId: 42n,
          memberAddress: ADDR,
        });
      });

      it('mapped: a person who is not a member is 404 (same answer as an unknown person)', async () => {
        readContract.mockResolvedValue(false);
        const notMember = await call();
        expect(notMember.status).toBe(404);
        findPersonBySlug.mockResolvedValue(null);
        findPersonByWeb3Address.mockResolvedValue(null);
        const unknown = await call();
        expect(unknown.status).toBe(404);
        expect(await notMember.json()).toEqual(await unknown.json());
      });

      it('mapped: a person without a wallet, or with a malformed one, is 404 and no chain read', async () => {
        for (const address of [null, undefined, '', '0xabc', 'not-an-address']) {
          findPersonBySlug.mockResolvedValue({ ...PERSON, address });
          findPersonByWeb3Address.mockResolvedValue({ ...PERSON, address });
          expect((await call()).status).toBe(404);
        }
        expect(readContract).not.toHaveBeenCalled();
      });

      it('mapped: a Space without an on-chain id, or an unknown host Space, is 404', async () => {
        findSpace.mockResolvedValue({ id: 7, web3SpaceId: null });
        expect((await call()).status).toBe(404);
        resetMappedHostScopeCache();
        findSpace.mockResolvedValue(null);
        expect((await call()).status).toBe(404);
        expect(readContract).not.toHaveBeenCalled();
      });

      it('mapped: a chain read error is a 500, never read as member', async () => {
        readContract.mockRejectedValue(new Error('rpc down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect((await call()).status).toBe(500);
        spy.mockRestore();
      });

      it('main app (no header): unchanged, full row, no scope or chain lookups', async () => {
        const res = await call(false);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(PERSON);
        expect(findSpace).not.toHaveBeenCalled();
        expect(readContract).not.toHaveBeenCalled();
      });

      it('main app: an unknown person answers as before (null, 200)', async () => {
        findPersonBySlug.mockResolvedValue(null);
        findPersonByWeb3Address.mockResolvedValue(null);
        const res = await call(false);
        expect(res.status).toBe(200);
        expect(await res.json()).toBeNull();
      });
    });
  }
});
