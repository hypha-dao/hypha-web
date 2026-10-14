import { NextResponse } from 'next/server';

import type { CampaignStateDto } from '@rs/lib/campaign-types';
import { optionalViewer } from '@rs/server/auth';
import { getCurrentCycle, toCycleDto } from '@rs/server/campaign/cycles';
import { listProjects } from '@rs/server/campaign/projects';
import { getTally } from '@rs/server/campaign/voting';
import { campaignConfig } from '@rs/server/config';
import { handle } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The public state of the campaign. Readable signed out — the standings are
 * meant to be shareable — and merely annotated with `yourVotes` when a valid
 * session is presented.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const [viewer, cycle, projects] = await Promise.all([
      optionalViewer(request),
      getCurrentCycle(),
      listProjects(),
    ]);

    const economics = {
      joinBonusRsut: campaignConfig.joinBonusRsut,
      rsutPerAud: campaignConfig.rsutPerAud,
      minContributionAud: campaignConfig.minContributionAud,
    };

    if (!cycle) {
      const empty: CampaignStateDto = {
        cycle: null,
        projects,
        tally: [],
        totals: {
          communityAud: 0,
          matchAud: 0,
          potAud: 0,
          contributors: 0,
          votesCast: 0,
        },
        economics,
      };
      return NextResponse.json(empty);
    }

    const tally = await getTally(cycle, viewer?.member.id ?? null);

    const state: CampaignStateDto = {
      cycle: toCycleDto(cycle),
      projects,
      tally: tally.rows,
      totals: tally.totals,
      economics,
    };
    return NextResponse.json(state);
  });
}
