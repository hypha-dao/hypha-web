'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { Msg } from '@/lib/data';
import { AgentMark, Avatar, cn } from './primitives';

export function Bubble({
  msg,
  agentName = 'River Commons',
  agentRole = 'agent',
}: {
  msg: Msg;
  agentName?: string;
  agentRole?: string;
}) {
  if (msg.system) {
    return (
      <div className="rise flex justify-center px-4">
        <div className="flex max-w-md items-start gap-2.5 rounded-2xl bg-agent-soft px-4 py-3">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-agent" />
          <p className="text-[13px] leading-relaxed text-agent">{msg.text}</p>
        </div>
      </div>
    );
  }
  const mine = msg.from === 'you';
  const agent = msg.from === 'agent';
  return (
    <div className={cn('rise flex gap-3 px-1', mine && 'flex-row-reverse')}>
      {!mine &&
        (agent ? (
          <AgentMark size={14} />
        ) : (
          <Avatar name={msg.from} size="sm" />
        ))}
      <div className={cn('max-w-[75%]', mine && 'text-right')}>
        {!mine && (
          <p className="mb-1 text-[12px] font-medium text-faint">
            {agent ? agentName : msg.from}
            {agent && <span className="ml-1.5 font-normal">{agentRole}</span>}
          </p>
        )}
        <p
          className={cn(
            'inline-block text-left text-[15px] leading-relaxed tracking-[-0.01em]',
            mine
              ? 'rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-white'
              : 'text-ink',
          )}
        >
          {msg.text}
        </p>
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="rise flex items-center gap-3 px-1">
      <AgentMark size={14} />
      <span className="flex gap-1 rounded-3xl px-1 py-2">
        <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
        <span className="dot h-1.5 w-1.5 rounded-full bg-faint" />
      </span>
    </div>
  );
}

export function Composer({
  onSend,
  placeholder = 'Write…',
  autoFocus,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }
  return (
    <form onSubmit={submit} className="shrink-0 px-4 pb-4 pt-2 md:px-6">
      <div className="flex items-center gap-2 rounded-full border border-hair bg-paper py-1.5 pl-5 pr-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-colors focus-within:border-faint/60">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="h-8 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white transition-all hover:bg-ink/85 active:scale-95 disabled:opacity-30"
          aria-label="Send"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 19V6M6 11.5 12 5.5l6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}

export function ScrollArea({
  children,
  deps,
}: {
  children: ReactNode;
  deps: unknown[];
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8 md:px-6">
        {children}
        <div ref={end} className="h-1" />
      </div>
    </div>
  );
}

export function ChoiceChips({
  options,
  onPick,
}: {
  options: string[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="rise-1 flex flex-wrap gap-2 pl-11">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className="rounded-full border border-hair bg-paper px-4 py-2 text-[14px] font-medium tracking-[-0.01em] transition-all hover:border-ink hover:bg-ink hover:text-white active:scale-[0.98]"
        >
          {o}
        </button>
      ))}
    </div>
  );
}
