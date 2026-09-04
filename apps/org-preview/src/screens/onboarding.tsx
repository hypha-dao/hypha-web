'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bubble,
  ChoiceChips,
  Composer,
  ScrollArea,
  TypingDots,
} from '@/components/chat';
import { AgentMark, Card, Chip, Kicker, cn } from '@/components/primitives';
import { Frame } from '@/components/workspace';
import { founding, jobs, type Msg } from '@/lib/data';
import { useStore } from '@/lib/store';

type Step =
  | 'intent'
  | 'who'
  | 'confirm'
  | 'orgkind'
  | 'jobs'
  | 'f1'
  | 'f2'
  | 'f3'
  | 'f4'
  | 'review';

let n = 0;
const uid = () => `m${++n}`;

export function Onboarding() {
  const s = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState<Step>('intent');
  const [answers, setAnswers] = useState<string[]>([]);
  const booted = useRef(false);

  const agentSay = useCallback((text: string, after?: () => void) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { id: uid(), from: 'agent', text }]);
      after?.();
    }, 650 + Math.min(text.length * 4, 500));
  }, []);

  const meSay = useCallback((text: string) => {
    setMsgs((m) => [...m, { id: uid(), from: 'you', text }]);
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    agentSay('Welcome. Do you want to join an organization — or create one?');
  }, [agentSay]);

  /* ---- handlers per step ---- */

  function pickIntent(v: string) {
    const join = v.startsWith('Join');
    s.setIntent(join ? 'join' : 'create');
    meSay(v);
    agentSay(
      'First, who are you? A name is enough. Drop social links or usernames if you like — anything that gives me context.',
      () => setStep('who'),
    );
    setStep('typing' as Step);
  }

  function onWho(text: string) {
    meSay(text);
    const name = guessName(text);
    const handle = text.match(/@[\w.]+/)?.[0] ?? '';
    s.setProfile({ name, handle, about: text });
    agentSay(`I have you as ${name}. Look right?`, () => setStep('confirm'));
    setStep('typing' as Step);
  }

  function confirm(v: string) {
    if (v === 'Edit') {
      agentSay('Tell me again — whatever should change.', () => setStep('who'));
      setStep('typing' as Step);
      return;
    }
    meSay('Looks right');
    if (s.intent === 'create') {
      agentSay(founding.questions[0], () => setStep('f1'));
    } else {
      agentSay(
        'What kind of organization are you after? Purpose, place, the work you like doing.',
        () => setStep('orgkind'),
      );
    }
    setStep('typing' as Step);
  }

  function onOrgKind(text: string) {
    meSay(text);
    agentSay(
      'Open work that fits you. Picking one is interest — nobody is assigned anything.',
      () => setStep('jobs'),
    );
    setStep('typing' as Step);
  }

  function onFounding(text: string, current: 'f1' | 'f2' | 'f3' | 'f4') {
    meSay(text);
    setAnswers((a) => [...a, text]);
    const idx = Number(current[1]);
    if (idx < 4) {
      agentSay(founding.questions[idx], () => setStep(`f${idx + 1}` as Step));
    } else {
      agentSay(
        'That is enough to open the doors. I drafted the space — a first mission, vision, objectives and strategy, the first Shapers, two projects, and the door. Until a second Shaper accepts, you confirm direction here, in this chat; after that, in the Shapers room. Nothing is invented; reject anything.',
        () => setStep('review'),
      );
    }
    setStep('typing' as Step);
  }

  const inputStep =
    step === 'who' || step === 'orgkind' || step.startsWith('f');

  return (
    <Frame>
      <header className="flex shrink-0 items-center gap-3 border-b border-hair px-5 py-3.5 md:px-8">
        <AgentMark size={15} />
        <div>
          <p className="text-[14px] font-semibold tracking-[-0.01em]">Hypha</p>
          <p className="text-[12px] text-faint">
            {s.intent === 'create' ? 'Creating a space' : 'First login'}
          </p>
        </div>
        <button
          type="button"
          onClick={s.skipToOrg}
          className="ml-auto rounded-full border border-hair px-3.5 py-1.5 text-[13px] font-medium text-sub transition-colors hover:border-ink hover:text-ink"
        >
          Skip — into River Commons →
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          <ScrollArea deps={[msgs.length, typing, step]}>
            {msgs.map((m) => (
              <Bubble
                key={m.id}
                msg={m}
                agentName="Hypha"
                agentRole="welcoming AI"
              />
            ))}
            {typing && <TypingDots />}

            {step === 'intent' && !typing && msgs.length > 0 && (
              <ChoiceChips
                options={['Join an organization', 'Create an organization']}
                onPick={pickIntent}
              />
            )}
            {step === 'confirm' && (
              <ChoiceChips options={['Looks right', 'Edit']} onPick={confirm} />
            )}
            {step === 'jobs' && (
              <div className="flex flex-col gap-2.5 pl-11">
                {jobs.map((job, i) => (
                  <Card
                    key={job.id}
                    delay={(i % 3) as 1 | 2}
                    onClick={() => s.pinJob(job.id)}
                    className="p-4"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <Chip tone={job.kind === 'project' ? 'agent' : 'neutral'}>
                        {job.kind === 'project'
                          ? 'Project — hold a job'
                          : 'Ticket — one piece'}
                      </Chip>
                    </div>
                    <p className="text-[15px] font-medium tracking-[-0.015em]">
                      {job.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-sub">
                      {job.why}
                    </p>
                    <p className="mt-2 text-[12px] font-medium text-faint">
                      River Commons · {job.project} →
                    </p>
                  </Card>
                ))}
              </div>
            )}
            {step === 'review' && (
              <div className="flex flex-col gap-2.5 pl-11">
                <ReviewCards />
                <button
                  type="button"
                  onClick={() => {
                    s.switchPersona('maya');
                    s.toast(
                      'River Commons is open. You are a Shaper now — founder is history.',
                    );
                  }}
                  className="rise-3 mt-1 self-start rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:bg-ink/85 active:scale-[0.98]"
                >
                  Create River Commons
                </button>
              </div>
            )}
          </ScrollArea>

          {inputStep && (
            <Composer
              autoFocus
              placeholder={
                step === 'who'
                  ? 'Maya · @maya.bsky · I run the street market…'
                  : step === 'orgkind'
                  ? 'Food, my street, I can host…'
                  : 'In your words…'
              }
              onSend={(t) => {
                if (step === 'who') onWho(t);
                else if (step === 'orgkind') onOrgKind(t);
                else onFounding(t, step as 'f1');
              }}
            />
          )}
        </div>

        {/* side panel: profile / space draft */}
        <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-hair bg-wash/70 p-5 lg:flex">
          <Kicker>
            {s.intent === 'create' ? 'Space draft' : 'Your profile'}
          </Kicker>
          <Card className={cn('p-4', !s.profile.name && 'opacity-50')}>
            <p className="text-[16px] font-semibold tracking-[-0.02em]">
              {s.profile.name || 'Waiting for you…'}
            </p>
            {s.profile.handle && (
              <p className="mt-0.5 text-[13px] text-agent">
                {s.profile.handle}
              </p>
            )}
            {s.profile.about && (
              <p className="mt-2 text-[13px] leading-relaxed text-sub">
                {s.profile.about}
              </p>
            )}
          </Card>
          {s.intent === 'create' &&
            answers.map((a, i) => (
              <Card key={i} className="rise p-4">
                <Kicker>{['Purpose', 'People', '90 days', 'Money'][i]}</Kicker>
                <p className="mt-1.5 text-[13px] leading-relaxed">{a}</p>
              </Card>
            ))}
          <p className="mt-auto pt-4 text-[12px] leading-relaxed text-faint">
            The conversation is the form. Cards fill as you talk; you confirm
            before anything exists.
          </p>
        </aside>
      </div>
    </Frame>
  );
}

function ReviewCards() {
  return (
    <>
      {founding.cards.map((c, i) => (
        <Card
          key={c.label}
          delay={(Math.min(i, 3) as 0 | 1 | 2 | 3) || undefined}
          className="p-4"
        >
          <Kicker>{c.label}</Kicker>
          <p className="mt-1.5 text-[14px] font-medium tracking-[-0.01em]">
            {c.value}
          </p>
        </Card>
      ))}
    </>
  );
}

function guessName(text: string) {
  const cleaned = text.replace(/https?:\/\/\S+|@[\w.]+/g, '').trim();
  const first = cleaned.split(/[\s,·|]+/).find((w) => w.length > 1);
  if (!first) return 'You';
  return first[0].toUpperCase() + first.slice(1);
}
