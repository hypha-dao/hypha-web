import { describe, expect, it } from 'vitest';
import { HYPHA_QUEST_HELPER_FIELD } from '../../matrix/rich-reply';
import { QUEST_HELPER_AUTHOR_ID } from '../constants';
import { questChannelOpenedNotice } from '../quest-channel-notice';

describe('quest channel opened notice', () => {
  it('keeps the acceptance copy and stamps the Quest Helper once', () => {
    const notice = questChannelOpenedNotice({
      acceptedDate: 'Fri, Nov 6, 2026',
      leadName: 'Ada Lovelace',
      memberNames: ['Ada Lovelace', 'Grace Hopper'],
    });
    expect(notice.body).toBe(
      'Quest accepted · Fri, Nov 6, 2026 — channel opened\nParticipants: Ada Lovelace, Grace Hopper',
    );
    expect(notice.extraContent).toEqual({
      [HYPHA_QUEST_HELPER_FIELD]: QUEST_HELPER_AUTHOR_ID,
    });
  });

  it('omits the participant line when nobody is named', () => {
    const notice = questChannelOpenedNotice({
      acceptedDate: 'Fri, Nov 6, 2026',
      leadName: '',
      memberNames: [],
    });
    expect(notice.body).toBe(
      'Quest accepted · Fri, Nov 6, 2026 — channel opened',
    );
  });
});
