import { describe, expect, it } from 'vitest';
import {
  HYPHA_INVESTMENT_FORM_END,
  HYPHA_INVESTMENT_FORM_START,
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
    // User-authored line stays; embedded payload + end marker removed
    expect(stripHyphaInvestmentFormMarker(full)).toBe(user);
  });

  it('removes only payload when user text has no hypha substring', () => {
    const user = 'rer';
    const json =
      '{"version":1,"investorAddress":"0xF97","investorSendLegs":[{"amount":"1","token":"0x947"}]}';
    const full = `${user}\n${json}\n__end_hypha_investment__`;
    expect(stripHyphaInvestmentFormMarker(full)).toBe(user);
  });
});
