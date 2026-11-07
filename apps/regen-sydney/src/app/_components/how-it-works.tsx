import { SectionHeading } from './ui';

const STEPS = [
  {
    title: 'Sign in with Google',
    body: 'A wallet is created for you in the background and 50 RSUT land in it as a joining bonus. No seed phrase, no transaction to sign.',
  },
  {
    title: 'Contribute if you can',
    body: 'Every A$1 you give is matched 1:1 by our philanthropic partners and mints another RSUT of voting power to you.',
  },
  {
    title: 'Spread your tokens',
    body: 'Put your whole balance behind one project or split it across many. Change your mind as often as you like until voting closes.',
  },
  {
    title: 'The pot follows the vote',
    body: 'When the round closes, the total pot is split pro-rata by vote share and Regen Sydney pays each project out.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-[var(--rs-cream)] px-5 py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="A simple loop"
          title="How it works"
          lede="Four steps, start to finish. Everything on-chain happens for you — you will never be asked to approve a transaction."
        />

        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="rs-heading flex size-14 items-center justify-center rounded-full bg-[var(--rs-peach)] text-xl">
                {index + 1}
              </div>
              <h3 className="rs-heading mt-5 text-lg leading-snug">
                {step.title}
              </h3>
              <p className="rs-prose mt-3 text-[0.95rem] text-[var(--rs-ink-soft)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
