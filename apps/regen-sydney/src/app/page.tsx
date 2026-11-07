'use client';

import { useState } from 'react';

import { ContributeBand } from './_components/contribute-band';
import { ContributeDialog } from './_components/contribute-dialog';
import { CycleStrip } from './_components/cycle-strip';
import { Hero } from './_components/hero';
import { HowItWorks } from './_components/how-it-works';
import { JoinNotice } from './_components/join-notice';
import { ProjectsSection } from './_components/projects-section';
import { RsFooter } from './_components/rs-footer';
import { RsHeader } from './_components/rs-header';
import { SignInDialog } from './_components/sign-in-dialog';
import { TallySection } from './_components/tally-section';
import { Wave } from './_components/ui';
import { VotingPowerBar } from './_components/voting-power-bar';

const CREAM = 'hsl(36.67 45% 92.16%)';
const SAND = 'hsl(36 42% 96%)';
const AQUA = 'hsl(182.55 41.59% 77.84%)';
const PEACH = 'hsl(29.46 77.78% 71.76%)';

export default function RegenSydneyCampaignPage() {
  const [signInOpen, setSignInOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);

  return (
    <>
      <JoinNotice />
      <RsHeader onSignIn={() => setSignInOpen(true)} />

      <main>
        <Hero
          onContribute={() => setContributeOpen(true)}
          onSignIn={() => setSignInOpen(true)}
        />
        <CycleStrip />
        <Wave from={AQUA} to={SAND} />
        <ProjectsSection onSignIn={() => setSignInOpen(true)} />
        <Wave from={SAND} to={PEACH} />
        <ContributeBand onContribute={() => setContributeOpen(true)} />
        <Wave from={PEACH} to={CREAM} />
        <HowItWorks />
        <Wave from={CREAM} to={SAND} />
        <TallySection />
      </main>

      <VotingPowerBar />
      <RsFooter />

      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
      <ContributeDialog
        open={contributeOpen}
        onClose={() => setContributeOpen(false)}
        onRequireSignIn={() => setSignInOpen(true)}
      />
    </>
  );
}
