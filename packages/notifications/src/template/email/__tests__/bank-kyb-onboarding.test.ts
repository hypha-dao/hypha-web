import { describe, expect, it } from 'vitest';

import { emailBankKybOnboarding } from '../bank-kyb-onboarding';

const base = {
  spaceTitle: 'Acme <DAO>',
  legalName: 'Acme "Labs" & Co',
  kycLink: 'https://kyc.test/a?x=1&y=2',
};

describe('emailBankKybOnboarding', () => {
  it('renders ToS and KYC steps when a tosLink is given', () => {
    const email = emailBankKybOnboarding({
      ...base,
      tosLink: 'https://tos.test/t',
    });
    expect(email.subject).toBe('Complete bank setup for Acme <DAO>');
    expect(email.preheader).toContain('Terms of Service');
    expect(email.body).toContain('<ol class="steps">');
    expect(email.body).toContain('href="https://tos.test/t"');
    expect(email.body).toContain('href="https://kyc.test/a?x=1&amp;y=2"');
  });

  it('omits the list and ToS step without a tosLink', () => {
    const email = emailBankKybOnboarding(base);
    expect(email.body).not.toContain('<ol');
    expect(email.body).not.toContain('Terms of Service');
    expect(email.preheader).not.toContain('Terms of Service');
    expect(email.body).toContain('Complete business verification');
  });

  it('escapes names and is transactional (no unsubscribe/settings)', () => {
    const { body } = emailBankKybOnboarding(base);
    expect(body).toContain('<strong>Acme &lt;DAO&gt;</strong>');
    expect(body).toContain('Organization: Acme &quot;Labs&quot; &amp; Co');
    expect(body).not.toContain('[unsubscribe_url]');
    expect(body).not.toContain('Manage notification settings');
  });
});
