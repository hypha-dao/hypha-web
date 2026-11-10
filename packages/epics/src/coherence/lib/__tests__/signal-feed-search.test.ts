import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COHERENCE_TYPE_OPTIONS } from '../../../../../core/src/coherence/coherence-types';
import { shouldSubmitComposerOnEnter } from '../composer-enter';
import { isArchivedSignalVoteError } from '../signal-upvote-errors';
import { signalTypeIcon } from '../../components/signal-type-icon';

const upvoteSource = readFileSync(
  resolve(__dirname, '../../components/signal-upvote-button.tsx'),
  'utf8',
);
const upvoteCellSource = readFileSync(
  resolve(__dirname, '../../components/signal-upvote-cell.tsx'),
  'utf8',
);
const feedRowSource = readFileSync(
  resolve(__dirname, '../../components/signal-feed-row.tsx'),
  'utf8',
);
const pageSource = readFileSync(
  resolve(__dirname, '../../components/signal-page.tsx'),
  'utf8',
);
const feedSource = readFileSync(
  resolve(__dirname, '../../components/coherence-block.tsx'),
  'utf8',
);
const badgeSource = readFileSync(
  resolve(__dirname, '../../components/signal-type-badge.tsx'),
  'utf8',
);

describe('signal type icons', () => {
  it('maps every supported coherence type, and no extra type', () => {
    const mapped = COHERENCE_TYPE_OPTIONS.map((option) => option.type);
    expect(mapped).toEqual([
      'Need',
      'Resource',
      'Opportunity',
      'Insight',
      'Tension',
      'Risk',
      'Action',
      'Impact',
      'Bug',
      'Trend',
      'Proposal',
    ]);
    for (const option of COHERENCE_TYPE_OPTIONS) {
      expect(signalTypeIcon(option.type), option.type).toBeTruthy();
    }
    expect(signalTypeIcon('NotAType')).toBeUndefined();
    expect(badgeSource).toContain('SignalTypeIcon');
  });
});

describe('upvote cell shared by the list and the detail', () => {
  it('uses one stacked cell and the canonical measure', () => {
    expect(feedRowSource).toContain('<SignalUpvoteButton');
    expect(pageSource).toContain('<SignalUpvoteButton');
    expect(feedRowSource).toContain('sort={sort}');
    expect(feedRowSource).toContain('timeFrame={timeFrame}');
    expect(pageSource).not.toContain('sort={sort}');
    expect(upvoteSource).toContain('signalUpvoteCellMeasure');
    expect(upvoteSource).toContain('<SignalUpvoteCellChrome');
    expect(upvoteCellSource).toContain('data-testid="signal-upvote-figure"');
    expect(upvoteSource).not.toContain("variant === 'feed'");
    expect(upvoteSource).not.toContain("variant === 'page'");
    expect(upvoteSource).toContain('isArchivedSignalVoteError');
    expect(upvoteSource).toContain("t('upvoteArchived')");
  });
});

describe('feed title search', () => {
  it('filters the full fetched list by title and keeps sort and time frame', () => {
    expect(feedSource).toContain('filterSignalsByTitle');
    expect(feedSource).toContain('rankSignals(matched, { sort, timeFrame })');
    expect(feedSource).toContain("SIGNAL_TITLE_QUERY_KEY = 'q'");
    expect(feedSource).not.toContain('search:');
    expect(feedSource).toContain('signalTitleNoResults');
    const filtersSource = readFileSync(
      resolve(__dirname, '../../components/signal-feed-filters.tsx'),
      'utf8',
    );
    expect(filtersSource).toContain('data-testid="signal-title-search"');
    expect(filtersSource).toContain('type="search"');
    expect(filtersSource).toContain(
      'leftIcon={<SearchIcon className="text-accent-9" size="16px" />}',
    );
    expect(filtersSource).toContain('rootClassName="min-w-0 flex-1"');
    expect(filtersSource).not.toContain('sm:max-w-sm');
    expect(filtersSource).toContain('flex flex-col gap-3');
    expect(feedSource).toContain("t('newSignal')");
    expect(feedSource).toContain('coherence/new-signal');
    expect(feedSource).not.toContain("t('createSignal')");
  });
});

describe('composer IME and archived votes', () => {
  it('does not submit while an IME composition is confirming Enter', () => {
    expect(
      shouldSubmitComposerOnEnter({
        key: 'Enter',
        isComposing: true,
        keyCode: 229,
      }),
    ).toBe(false);
    expect(shouldSubmitComposerOnEnter({ key: 'Enter', keyCode: 229 })).toBe(
      false,
    );
    expect(shouldSubmitComposerOnEnter({ key: 'Enter' })).toBe(true);
    expect(shouldSubmitComposerOnEnter({ key: 'a' })).toBe(false);
  });

  it('recognises an archived-signal rejection and ignores other failures', () => {
    expect(isArchivedSignalVoteError(new Error('Archived signal'))).toBe(true);
    expect(isArchivedSignalVoteError(new Error('upvote failed'))).toBe(false);
    expect(isArchivedSignalVoteError('archived signal')).toBe(false);
  });
});
