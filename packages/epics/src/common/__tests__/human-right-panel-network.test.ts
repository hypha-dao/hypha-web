import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../human-right-panel.tsx'),
  'utf8',
);

describe('network room join guard', () => {
  it('only ensures the network room on /{lang}/network', () => {
    expect(source).toContain('isNetworkPath(pathname)');
    expect(source).toContain('ensureNetworkRoom');
    const ensureAt = source.indexOf('await ensureNetworkRoom()');
    expect(ensureAt).toBeGreaterThan(-1);
    const guardAt = source.lastIndexOf(
      'if (!isNetworkPath(pathname)) return;',
      ensureAt,
    );
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(ensureAt);
  });

  it('does not inherit a DHO space slug while on Network in space mode', () => {
    expect(source).toContain('routeSpaceSlugFromLocation');
    expect(source).toContain("onNetworkPage && mode === 'space'");
    expect(source).toContain(
      'Entering Network clears leftover DHO / coherence space chrome',
    );
  });

  it('locks timeline paints to the intended room before join awaits (HE → HUMAI)', () => {
    expect(source).toContain('paintedRoomId');
    expect(source).toContain(
      'openingTimelineRoomIdRef.current = intendedRoomId',
    );
    expect(source).toContain(
      'activeRoom && messages.length > 0 && (!painted || painted === activeRoom)',
    );
    expect(source).toContain('Mid-switch both refs may be empty');
  });

  it('shows mycelium + Network label + earth globe for network chrome', () => {
    expect(source).toContain('MemberHomeMark');
    expect(source).toContain(
      "coherenceChannel === 'network' || isNetworkSpaceChat",
    );
    expect(source).toContain('messagesChannelGlyph');
    expect(source).toContain('channelIcon=');
    expect(source).toContain('networkRoomTitle');
  });

  it('shows the composer for Network opened from Messages inbox', () => {
    expect(source).toContain('<HumanChatPanelChatBar');
    expect(source).toContain("coherenceChannel === 'network'");
    expect(source).toContain(
      "isNetworkSpaceChat ||\n          coherenceChannel === 'network'",
    );
  });

  it('puts a space logo and channel-type mark on Messages signal/proposal/ecosystem', () => {
    expect(source).toContain("coherenceChannel === 'signal'");
    expect(source).toContain("coherenceChannel === 'proposal'");
    expect(source).toContain('messagesChannelGlyph(coherenceChannel)');
  });

  it('does not flash the legacy Hypha placeholder while the space logo loads', () => {
    expect(source).toContain('HeaderSpaceLogoMark');
    expect(source).toContain('loading={isSpaceLoading}');
    const headerMarkAt = source.indexOf('function HeaderSpaceLogoMark');
    expect(headerMarkAt).toBeGreaterThan(-1);
    expect(source.slice(headerMarkAt, headerMarkAt + 900)).not.toContain(
      'DEFAULT_SPACE_AVATAR_IMAGE',
    );
  });

  it('treats Home / Messages space mode without a slug as not the network room', () => {
    expect(source).toContain(
      "const isNetworkSpaceChat = onNetworkPage && mode === 'space'",
    );
    expect(source).toContain('!isNetworkSpaceChat');
    expect(source).toContain('Leaving Network clears that join sentinel');
  });

  it('answers a Context room opened from Messages with its section agent', () => {
    expect(source).toContain("coherenceChannel === 'context'");
    expect(source).toContain('useSpaceContextSectionAgent(');
    expect(source).toContain(
      "contextSectionAgent?.label ?? t('agentMentionLabel')",
    );
    expect(source).toContain(
      'contextSectionAgent?.skills ?? matrixAgentSkills(t)',
    );
    expect(source).toContain("kind: 'space_context'");
    expect(source).toContain('sectionKey: contextSectionKey');
    expect(source).toContain(
      '<AgentMentionLabelProvider value={agentMentionLabel}>',
    );
    const pickerAt = source.indexOf('return withMatrixAgentMention(');
    expect(pickerAt).toBeGreaterThan(-1);
    expect(source.slice(pickerAt, pickerAt + 220)).toContain(
      "roster,\n      t('agentMentionLabel'),",
    );
  });
});
