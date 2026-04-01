'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from '@hypha-platform/ui';

import {
  HumanChatPanelHeader,
  HumanChatPanelMessages,
  HumanChatPanelChatBar,
} from './human-chat-panel';

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  senderName?: string;
};

export function HumanRightPanel() {
  const t = useTranslations('HumanChatPanel');
  const [input, setInput] = useState('');
  const [messages] = useState<UIMessage[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;
    // Placeholder — no real implementation
    setInput('');
  };

  return (
    <>
      <SidebarHeader className="bg-background-2 p-0">
        <HumanChatPanelHeader />
      </SidebarHeader>
      <SidebarContent className="bg-background-2 min-h-0">
        <HumanChatPanelMessages messages={messages} />
      </SidebarContent>
      <SidebarFooter className="bg-background-2 p-0">
        <HumanChatPanelChatBar
          value={input}
          onChange={setInput}
          onSend={handleSend}
        />
      </SidebarFooter>
    </>
  );
}
