import { describe, expect, it } from 'vitest';
import {
  HYPHA_INVESTMENT_FORM_END,
  HYPHA_INVESTMENT_FORM_START,
  appendHyphaInvestmentFormMarker,
  stripHyphaInvestmentFormMarker,
} from '../escrow';

describe('stripHyphaInvestmentFormMarker', () => {
  it('removes canonical marker block', () => {
    const user = 'Hello proposal';
    const payload = JSON.stringify({
      version: 1,
      investorAddress: '0xabc',
      investorSendLegs: [],
    });
    const full =
      user + HYPHA_INVESTMENT_FORM_START + payload + HYPHA_INVESTMENT_FORM_END;
    expect(stripHyphaInvestmentFormMarker(full)).toBe(user);
  });

  it('removes JSON after mangled markdown when end delimiter exists', () => {
    const user = 'rer hypha_investment';
    const json =
      '{"version":1,"investorAddress":"0xF97Ce6adAC3E90a3e01","investorSendLegs":[{"amount":"1","token":"0x947"}]}';
    const full = `${user}\n${json}\n__end_hypha_investment__`;
    expect(stripHyphaInvestmentFormMarker(full)).toBe(user);
  });

  it('removes only payload when user text has no hypha substring', () => {
    const user = 'rer';
    const json =
      '{"version":1,"investorAddress":"0xF97","investorSendLegs":[{"amount":"1","token":"0x947"}]}';
    const full = `${user}\n${json}\n__end_hypha_investment__`;
    expect(stripHyphaInvestmentFormMarker(full)).toBe(user);
  });

  it('removes stacked marker blocks left by older resubmits', () => {
    const user = 'Hello proposal';
    const payload1 = JSON.stringify({
      version: 1,
      investorAddress: '0xabc',
      investorSendLegs: [],
    });
    const payload2 = JSON.stringify({
      version: 1,
      investorAddress: '0xdef',
      investorSendLegs: [],
    });
    const full =
      user +
      HYPHA_INVESTMENT_FORM_START +
      payload1 +
      HYPHA_INVESTMENT_FORM_END +
      HYPHA_INVESTMENT_FORM_START +
      payload2 +
      HYPHA_INVESTMENT_FORM_END;
    expect(stripHyphaInvestmentFormMarker(full)).toBe(user);
  });

  it('removes markdown-escaped marker block produced by editor re-save', () => {
    const user = 'tret';
    const json =
      '{"version":1,"investorAddress":"0x08b","investorSendLegs":[{"amount":"1","token":"0x933"}]}';
    const escaped = `${user}\n\n\\_\\_hypha\\_investment\\_\\_\n${json}\n\\_\\_end\\_hypha\\_investment\\_\\_`;
    expect(stripHyphaInvestmentFormMarker(escaped)).toBe(user);
  });
});

describe('appendHyphaInvestmentFormMarker', () => {
  it('does not double-stack markers when called on an already-marked description', () => {
    const user = 'Hello proposal';
    const payload = {
      version: 1 as const,
      investorAddress: '0xabc',
      investorSendLegs: [{ amount: '1', token: '0x933' }],
    };
    const once = appendHyphaInvestmentFormMarker(user, payload);
    const twice = appendHyphaInvestmentFormMarker(once, payload);
    expect(twice).toBe(once);
    expect(stripHyphaInvestmentFormMarker(twice)).toBe(user);
  });
});
