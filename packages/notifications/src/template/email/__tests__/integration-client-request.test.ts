import { describe, expect, it } from 'vitest';

import { emailIntegrationClientRequest } from '../integration-client-request';

const base = {
  clientName: 'Acme <App>',
  slug: 'acme-app',
  contactEmail: 'dev@acme.test',
  scopes: ['agreements:vote'],
  allowedOrigins: [],
  requesterName: 'Pat "P" & Co',
  requesterSlug: 'pat',
};

describe('emailIntegrationClientRequest', () => {
  it('names the client in the subject and the requester in the preheader', () => {
    const email = emailIntegrationClientRequest(base);
    expect(email.subject).toBe('New integration client request: Acme <App>');
    expect(email.preheader).toContain('acme-app');
    expect(email.preheader).toContain('Pat "P" & Co');
  });

  it('prints the integration API approve path for the slug', () => {
    const { body } = emailIntegrationClientRequest(base);
    expect(body).toContain(
      'POST /api/integration/v1/ops/clients/acme-app/approve',
    );
    expect(body).not.toContain('/api/v1/ops');
  });

  it('escapes every requester-supplied value', () => {
    const { body } = emailIntegrationClientRequest({
      ...base,
      description: '<script>x</script>',
      slug: 'a"b',
    });
    expect(body).toContain('Acme &lt;App&gt;');
    expect(body).toContain('Pat &quot;P&quot; &amp; Co');
    expect(body).not.toContain('<script>x</script>');
    expect(body).toContain('a&quot;b');
  });

  it('shows a dash for empty origins and description, and is transactional', () => {
    const { body } = emailIntegrationClientRequest(base);
    expect(body).toContain('Allowed origins:</strong> —');
    expect(body).toContain('Description:</strong> —');
    expect(body).not.toContain('[unsubscribe_url]');
  });
});
