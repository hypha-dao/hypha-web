// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  QuestDraftParticipantsCard,
  questParticipantRoleText,
} from '../../components/quest-detail-presentation';
import { draftParticipantRoleLabel } from '../quest-draft-member-role';

afterEach(() => {
  cleanup();
});

describe('draft participant role', () => {
  it('uses Participant for a blank role and keeps an explicit role', () => {
    expect(draftParticipantRoleLabel(null)).toBe('Participant');
    expect(draftParticipantRoleLabel(undefined)).toBe('Participant');
    expect(draftParticipantRoleLabel('')).toBe('Participant');
    expect(draftParticipantRoleLabel('   ')).toBe('Participant');
    expect(draftParticipantRoleLabel(' QA runner ')).toBe('QA runner');
    expect(draftParticipantRoleLabel('Lead')).toBe('Lead');
    expect(
      questParticipantRoleText({ roleLabel: '   ', isLead: false }),
    ).toBeNull();
    expect(
      questParticipantRoleText({ roleLabel: 'Participant', isLead: false }),
    ).toBeNull();
    expect(questParticipantRoleText({ roleLabel: null, isLead: true })).toBe(
      'Lead',
    );

    const members = [
      {
        personId: 9,
        memberName: 'QA Tester',
        roleLabel: '   ',
        responsibilities: ['Run the checklist', 'Record the result'],
      },
      {
        personId: 10,
        memberName: 'Ada Lovelace',
        roleLabel: ' QA runner ',
        responsibilities: ['Review the notes'],
      },
    ].map((member) => ({
      personId: member.personId,
      memberName: member.memberName,
      roleLabel: draftParticipantRoleLabel(member.roleLabel),
      responsibilities: member.responsibilities,
    }));

    expect(members[0]).toMatchObject({
      personId: 9,
      roleLabel: 'Participant',
      responsibilities: ['Run the checklist', 'Record the result'],
    });
    expect(members[1]?.roleLabel).toBe('QA runner');

    render(
      <QuestDraftParticipantsCard members={members} onEdit={() => undefined} />,
    );
    const overview = screen.getByTestId('draft-section-members');
    expect(within(overview).getByText('QA Tester')).toBeTruthy();
    expect(within(overview).queryByText('Participant')).toBeNull();
    expect(within(overview).getAllByText('RESPONSIBILITY')).toHaveLength(2);
    expect(within(overview).getByText('QA runner')).toBeTruthy();
    expect(within(overview).getByText('Run the checklist')).toBeTruthy();
    expect(within(overview).getByText('Record the result')).toBeTruthy();
    expect(within(overview).getByText('Review the notes')).toBeTruthy();
    expect(within(overview).queryByText('Lead')).toBeNull();
  });
});
