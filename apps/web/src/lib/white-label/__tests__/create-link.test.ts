import { describe, expect, it } from 'vitest';

import {
  classifyLink,
  type CreateAction,
  type WhiteLabelLinkContext,
} from '..';

const locales = ['en', 'pt', 'es'];
const here = 'https://space.partner.example';
const app = 'https://app.example';

const host = (createActions?: CreateAction[]): WhiteLabelLinkContext => ({
  mode: 'host',
  spaceSlug: 's1',
  lang: 'en',
  fullAppOrigin: app,
  ...(createActions ? { createActions } : {}),
});
const embed = (createActions?: CreateAction[]): WhiteLabelLinkContext => ({
  mode: 'embed',
  spaceSlug: 's1',
  lang: 'en',
  ...(createActions ? { createActions } : {}),
});

const link = (href: string, ctx: WhiteLabelLinkContext, origin = here) =>
  classifyLink(href, ctx, origin, locales);

const MAIN = '/pt/dho/s1';

describe('served create pages', () => {
  it('signal: served only with `signal`, in the host, main-app shape and embed', () => {
    expect(link(`${MAIN}/coherence/new-signal`, host(['signal']))).toEqual({
      kind: 'internal',
      href: '/pt/coherence/new-signal',
    });
    expect(link('/en/coherence/new-signal?type=x', host(['signal']))).toEqual({
      kind: 'internal',
      href: '/en/coherence/new-signal?type=x',
    });
    expect(
      link('/embed/s1/en/coherence/new-signal', embed(['signal']), app),
    ).toEqual({ kind: 'internal', href: '/embed/s1/en/coherence/new-signal' });
    for (const without of [undefined, [], ['agreement'] as CreateAction[]]) {
      expect(link(`${MAIN}/coherence/new-signal`, host(without))).toEqual({
        kind: 'blocked',
      });
    }
  });

  it('menu: served with either proposal value; each form with its own', () => {
    const menu = `${MAIN}/agreements/select-create-action`;
    const agreement = `${MAIN}/agreements/create`;
    const contribution = `${MAIN}/agreements/create/propose-contribution`;
    expect(link(menu, host(['agreement']))?.kind).toBe('internal');
    expect(link(menu, host(['contribution']))?.kind).toBe('internal');
    expect(link(menu, host(['signal']))).toEqual({ kind: 'blocked' });

    expect(link(agreement, host(['agreement']))).toEqual({
      kind: 'internal',
      href: '/pt/agreements/create',
    });
    expect(link(agreement, host(['contribution']))).toEqual({
      kind: 'blocked',
    });
    expect(link(contribution, host(['contribution']))).toEqual({
      kind: 'internal',
      href: '/pt/agreements/create/propose-contribution',
    });
    expect(link(contribution, host(['agreement']))).toEqual({
      kind: 'blocked',
    });
  });

  it('every other create path stays blocked, even with all values', () => {
    const all = host(['signal', 'agreement', 'contribution']);
    for (const path of [
      '/agreements/create/pay-for-expenses',
      '/agreements/create/redeem-tokens',
      '/agreements/create/airdrop',
      '/coherence/new-memory',
      '/calendar/new-scheduled-item',
      '/treasury/create/issue-new-token',
      '/agreements/select-settings-action',
    ]) {
      const decision = link(`${MAIN}${path}`, all);
      expect(decision?.kind, path).not.toBe('internal');
    }
  });

  it('with full-app, a create path that is not served still leaves', () => {
    const ctx: WhiteLabelLinkContext = {
      ...host(['signal']),
      unsupportedActions: 'full-app',
    };
    expect(link(`${MAIN}/agreements/create`, ctx)).toEqual({
      kind: 'external',
      href: `${app}${MAIN}/agreements/create`,
    });
  });

  it('a slug named like a marker is not a create page', () => {
    const decision = link(
      `${MAIN}/coherence/signal/new-signal`,
      host(['signal']),
    );
    expect(decision?.kind).not.toBe('blocked');
  });
});
