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
    expect(feedRowSource).not.toContain('timeFrame={timeFrame}');
    expect(upvoteSource).not.toContain('timeFrame');
    expect(pageSource).not.toContain('sort={sort}');
    expect(upvoteSource).toContain('signalUpvoteCellMeasure');
    expect(upvoteSource).toContain('<SignalUpvoteCellChrome');
    expect(upvoteCellSource).toContain('data-testid="signal-upvote-figure"');
    expect(upvoteCellSource).toContain("'signal-vote-up'");
    expect(upvoteCellSource).toContain("'signal-vote-down'");
    expect(upvoteCellSource).toContain('ArrowUp');
    expect(upvoteCellSource).toContain('ArrowDown');
    expect(upvoteCellSource).toContain('rounded-none');
    expect(upvoteCellSource).not.toContain('rounded-full');
    expect(upvoteCellSource).toContain('<PopoverAnchor asChild>');
    expect(upvoteCellSource).not.toContain("t('net')");
    expect(upvoteSource).toContain('resolveSignalVoteAction');
    expect(upvoteSource).toContain('applyPendingSignalUpvotes');
    expect(upvoteSource).toContain('votingPowerPercent: percent');
    expect(upvoteSource).toContain('handleConfirmAllocation');
    expect(upvoteSource).toContain("t('confirmVote')");
    expect(upvoteSource).toContain("t('cancelVote')");
    expect(upvoteSource).toContain('<Slider');
    expect(upvoteSource).toContain('<SignalVoteTotals');
    expect(upvoteSource).toContain('<SignalVoteRoster');
    const metaAt = feedRowSource.indexOf('data-testid="signal-card-meta"');
    const buttonAt = feedRowSource.indexOf('<SignalUpvoteButton');
    const createdAt = feedRowSource.indexOf("t('signalCreated'");
    expect(metaAt).toBeGreaterThan(-1);
    expect(buttonAt).toBeGreaterThan(metaAt);
    expect(createdAt).toBeGreaterThan(buttonAt);
    expect(feedRowSource).not.toContain('flex items-start gap-4');
    const pageTitleAt = pageSource.indexOf(
      '<h1 className="m-0 min-w-0 text-4 leading-tight text-foreground">',
    );
    const pageButtonAt = pageSource.indexOf('<SignalUpvoteButton');
    const pageMetaAt = pageSource.indexOf('data-testid="signal-page-meta"');
    expect(pageTitleAt).toBeGreaterThan(-1);
    expect(pageButtonAt).toBeGreaterThan(pageTitleAt);
    expect(pageMetaAt).toBeGreaterThan(pageButtonAt);
    expect(pageSource).toContain("t('openDiscussion')");
    expect(pageSource).toContain('data-testid="signal-open-discussion"');
    expect(pageSource).toContain(
      'inline-flex shrink-0 items-center gap-1 text-xs font-bold text-foreground underline-offset-2 hover:underline',
    );
    expect(pageSource).toContain('onClick={openChat}');
    const metaSlice = pageSource.slice(
      pageMetaAt,
      pageSource.indexOf('</dl>', pageMetaAt),
    );
    expect(metaSlice).toContain(
      'flex w-full flex-nowrap items-start gap-x-[clamp(1rem,4vw,3.5rem)] gap-y-4',
    );
    expect(metaSlice).toContain('max-[420px]:flex-wrap');
    expect(pageSource).toContain('min-w-[5.5rem] max-w-full shrink');
    expect(pageSource).toContain('signalDiscussionCount');
    expect(metaSlice).not.toContain('col-span-full');
    expect(metaSlice).not.toContain('grid-cols-2');
    const createdByAt = metaSlice.indexOf("t('signalCreatedBy')");
    const createdLabelAt = metaSlice.indexOf("t('signalCreatedLabel')");
    const discussionAt = metaSlice.indexOf("t('signalDiscussion')");
    const openAt = metaSlice.indexOf('data-testid="signal-open-discussion"');
    expect(createdByAt).toBeGreaterThan(-1);
    expect(createdLabelAt).toBeGreaterThan(createdByAt);
    expect(discussionAt).toBeGreaterThan(createdLabelAt);
    expect(openAt).toBeGreaterThan(discussionAt);
    expect(metaSlice).toContain(
      'ml-auto flex max-w-full shrink-0 flex-col gap-1',
    );
    expect(upvoteSource).not.toContain("t('totalUpvotes')");
    expect(upvoteSource).not.toContain("t('supportersCount')");
    const voteSummarySource = readFileSync(
      resolve(__dirname, '../../components/signal-vote-summary.tsx'),
      'utf8',
    );
    expect(voteSummarySource).toContain("t('votes')");
    expect(voteSummarySource).toContain("t('noVotesYet')");
    expect(voteSummarySource).toContain("t('voteUp')");
    expect(voteSummarySource).toContain("t('voteDown')");
    expect(voteSummarySource).toContain("t('upVotesCount'");
    expect(voteSummarySource).toContain("t('upVotesPower'");
    expect(feedRowSource).toContain('spaceSlug={spaceSlug}');
    expect(pageSource).toContain('spaceSlug={spaceSlug}');
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
    expect(feedSource).not.toContain('<Plus');
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
