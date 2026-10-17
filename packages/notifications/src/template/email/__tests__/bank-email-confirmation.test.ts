import { describe, expect, it } from 'vitest';

import { emailBankEmailConfirmation } from '../bank-email-confirmation';

describe('emailBankEmailConfirmation', () => {
  const email = emailBankEmailConfirmation({
    ownerLabel: 'Acme <Labs>',
    verifyLink: 'https://app.hypha.earth/en/verify/banking?token=a&b=1',
  });

  it('builds subject and preheader from the owner label', () => {
    expect(email.subject).toBe(
      'Authorize your email for bank integration – Acme <Labs>',
    );
    expect(email.preheader).toContain('Acme <Labs>');
  });

  it('escapes the owner label and link, with CTA and fallback link', () => {
    expect(email.body).toContain('<strong>Acme &lt;Labs&gt;</strong>');
    expect(email.body).toContain(
      'class="cta" href="https://app.hypha.earth/en/verify/banking?token=a&amp;b=1"',
    );
    expect(email.body).toContain('class="muted"');
  });

  it('is transactional: no unsubscribe or settings link, no greeting', () => {
    expect(email.body).not.toContain('[unsubscribe_url]');
    expect(email.body).not.toContain('Manage notification settings');
    expect(email.body).not.toContain('Hey there,');
  });
});
