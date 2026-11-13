import { describe, expect, it } from 'vitest';
import {
  SPACE_QUEST_DETAIL_TABS,
  isRetiredQuestParticipantTab,
  isSpaceQuestDetailTab,
  questDetailSearchTargetsParticipantTab,
  spaceQuestDetailTabLinks,
} from '../../space-quest-tabs';

describe('quest detail tabs', () => {
  it('lists overview, updates, and settings', () => {
    expect(SPACE_QUEST_DETAIL_TABS).toEqual([
      'overview',
      'updates',
      'settings',
    ]);
    const links = spaceQuestDetailTabLinks('/en/dho/sandbox/quests/alpha');
    expect(links.map((tab) => tab.label)).toEqual([
      'OVERVIEW',
      'UPDATES',
      'SETTINGS',
    ]);
    expect(links.map((tab) => tab.key)).toEqual([
      'overview',
      'updates',
      'settings',
    ]);
    expect(links.map((tab) => tab.href)).toEqual([
      '/en/dho/sandbox/quests/alpha',
      '/en/dho/sandbox/quests/alpha/updates',
      '/en/dho/sandbox/quests/alpha/settings',
    ]);
    expect(links.some((tab) => /participant/i.test(tab.label))).toBe(false);
    expect(links.some((tab) => tab.href.endsWith('/members'))).toBe(false);
  });

  it('sends a participants deep link or query back to overview', () => {
    expect(isSpaceQuestDetailTab('members')).toBe(false);
    expect(isSpaceQuestDetailTab('participants')).toBe(false);
    expect(isSpaceQuestDetailTab('overview')).toBe(true);
    expect(isRetiredQuestParticipantTab('members')).toBe(true);
    expect(isRetiredQuestParticipantTab('Participants')).toBe(true);
    expect(isRetiredQuestParticipantTab('updates')).toBe(false);
    expect(questDetailSearchTargetsParticipantTab({ tab: 'members' })).toBe(
      true,
    );
    expect(
      questDetailSearchTargetsParticipantTab({ questTab: ['participants'] }),
    ).toBe(true);
    expect(questDetailSearchTargetsParticipantTab({ tab: 'settings' })).toBe(
      false,
    );
    expect(questDetailSearchTargetsParticipantTab(undefined)).toBe(false);
  });
});
