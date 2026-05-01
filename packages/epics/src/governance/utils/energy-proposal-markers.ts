type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

const MARKER_START = '__hypha_energy_proposal__';
const MARKER_END = '__end_hypha_energy_proposal__';

export const appendEnergyProposalMarker = (
  description: string,
  proposalType: string,
  payload: JsonValue,
) => {
  const normalized = stripEnergyProposalMarker(description);
  const markerPayload = JSON.stringify({ proposalType, payload });
  return `${normalized}\n\n${MARKER_START}\n${markerPayload}\n${MARKER_END}\n`;
};

export const parseEnergyProposalMarker = (
  description: string | null | undefined,
): { proposalType: string; payload: JsonValue } | null => {
  if (!description) return null;
  const start = description.indexOf(MARKER_START);
  const end = description.indexOf(MARKER_END);
  if (start === -1 || end === -1 || end <= start) return null;
  const json = description.slice(start + MARKER_START.length, end).trim();
  try {
    const parsed = JSON.parse(json) as {
      proposalType?: unknown;
      payload?: JsonValue;
    };
    if (
      typeof parsed.proposalType !== 'string' ||
      parsed.payload === undefined
    ) {
      return null;
    }
    return {
      proposalType: parsed.proposalType,
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
};

export const stripEnergyProposalMarker = (
  description: string | null | undefined,
) => {
  if (!description) return '';
  const start = description.indexOf(MARKER_START);
  const end = description.indexOf(MARKER_END);
  if (start === -1 || end === -1 || end <= start) return description;
  const before = description.slice(0, start).trimEnd();
  const after = description.slice(end + MARKER_END.length).trimStart();
  return `${before}${after ? `\n\n${after}` : ''}`;
};
