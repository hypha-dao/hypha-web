import { describe, expect, it } from 'vitest';

import {
  emailProposalCreationForMembers,
  emailProposalExecutionForCreator,
  emailProposalExecutionForMembers,
  emailProposalRejectionForCreator,
} from '..';

const links = {
  url: 'https://app.hypha.earth/en/dho/acme/agreements/p1',
  settingsUrl: 'https://app.hypha.earth/en/network/notification-centre',
};

describe('emailProposalExecutionForCreator (dashboard: Proposals - Accepted - for creator)', () => {
  it('matches the dashboard subject, preheader and statement', () => {
    const email = emailProposalExecutionForCreator({
      proposalTitle: 'Fund <garden>',
      spaceTitle: 'Acme',
      ...links,
    });
    expect(email.subject).toBe('Your proposal was accepted in Acme');
    expect(email.preheader).toBe('Fund <garden>');
    expect(email.body).toContain(
      'Your proposal &ldquo;Fund &lt;garden&gt;&rdquo; was <strong>accepted</strong> in <strong>Acme</strong>. ✅',
    );
    expect(email.body).toContain('class="cta" href="' + links.url + '"');
    expect(email.body).toContain('>View proposal<');
    expect(email.body).toContain('[unsubscribe_url]');
    expect(email.body).toContain('Manage notification settings');
  });

  it('falls back to defaults without a title or space', () => {
    const email = emailProposalExecutionForCreator({});
    expect(email.subject).toBe('Your proposal was accepted in your space');
    expect(email.preheader).toBe('See the outcome.');
    expect(email.body).toContain('Your proposal was <strong>accepted</strong>');
  });
});

describe('emailProposalCreationForMembers (dashboard: Proposals - Created - for members)', () => {
  it('renders the new-proposal variant with the vote prompt', () => {
    const email = emailProposalCreationForMembers({
      creatorName: 'Alice',
      proposalTitle: 'Plan',
      spaceTitle: 'Acme',
      ...links,
    });
    expect(email.subject).toBe('New proposal in Acme');
    expect(email.preheader).toBe('Plan');
    expect(email.body).toContain(
      '<strong>Alice</strong> created a new proposal &ldquo;Plan&rdquo; in <strong>Acme</strong>.',
    );
    expect(email.body).toContain('Have a look and cast your vote.');
  });

  it('renders the join-request variant for invites', () => {
    const email = emailProposalCreationForMembers({
      creatorName: 'Alice',
      proposalLabel: 'Invite',
      spaceTitle: 'Acme',
      ...links,
    });
    expect(email.subject).toBe('New join request in Acme');
    expect(email.preheader).toBe('Have a look and cast your vote.');
    expect(email.body).toContain(
      '<strong>Alice</strong> wants to join <strong>Acme</strong>.',
    );
  });

  it('defaults the creator to "Someone"', () => {
    expect(emailProposalCreationForMembers({ ...links }).body).toContain(
      '<strong>Someone</strong>',
    );
  });
});

describe('emailProposalExecutionForMembers (dashboard: Proposals - Accepted - for members)', () => {
  it('matches the dashboard subject, preheader and statement', () => {
    const email = emailProposalExecutionForMembers({
      proposalTitle: 'Plan',
      spaceTitle: 'Acme',
      ...links,
    });
    expect(email.subject).toBe('A proposal was accepted in Acme');
    expect(email.preheader).toBe('Plan');
    expect(email.body).toContain(
      'A proposal &ldquo;Plan&rdquo; was <strong>accepted</strong> in <strong>Acme</strong>. ✅',
    );
  });

  it('defaults preheader and space', () => {
    const email = emailProposalExecutionForMembers({});
    expect(email.subject).toBe('A proposal was accepted in your space');
    expect(email.preheader).toBe('See the outcome.');
  });
});

describe('emailProposalRejectionForCreator', () => {
  it('neutralises non-http(s) CTA urls', () => {
    const email = emailProposalRejectionForCreator({
      url: 'javascript:alert(1)',
    });
    expect(email.body).toContain('class="cta" href="#"');
    expect(email.subject).toBe('Your proposal was rejected in your space');
  });
});
