import type { LucideIcon } from 'lucide-react';
import { Zap, Brain, Globe } from 'lucide-react';

export type ModelOption = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const MOCK_MODEL_OPTIONS: ModelOption[] = [
  { id: 'gemini-flash', label: 'Gemini 2.5 Flash', icon: Zap },
  { id: 'gpt5', label: 'GPT-5', icon: Brain },
  { id: 'gemini-pro', label: 'Gemini Pro', icon: Globe },
];

export const MOCK_SUGGESTIONS = [
  'Analyze recent signals',
  'Summarize top conversations',
  'Draft a coordination proposal',
  'Find alignment opportunities',
];

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

export const MOCK_WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hello! I'm your Hypha AI assistant. I can help you analyze signals, draft proposals, understand community dynamics, and coordinate across spaces. What would you like to explore?",
  timestamp: new Date(),
};

export const MOCK_AI_RESPONSES = [
  "Based on the current signal data, I can see a strong opportunity in the DeFi governance space. Three communities have shown 40%+ engagement spikes in the last 48 hours. Would you like me to generate a detailed breakdown?",
  "I've analyzed 127 signals across your tracked spaces. The most actionable insight is a convergence of treasury proposals in 3 DAOs that align with your stated objectives. Shall I draft a summary report?",
  "The pattern suggests this is a coordination signal, not noise. Similar signals in Q3 preceded successful multi-DAO collaborations. I recommend prioritizing this for immediate conversation.",
];
