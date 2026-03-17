import { type Log, parseEventLogs } from 'viem';
import { daoSpaceFactoryImplementationAbi } from '@hypha-platform/core/generated';

/**
 * Extract the SpaceCreated event from transaction logs
 * @param logs - The transaction logs to parse
 * @returns The SpaceCreated event if found, undefined otherwise
 */
export const getSpaceCreatedEvent = (logs: unknown[]) => {
  try {
    // Parse logs for the specific event
    const spaceCreatedEvents = parseEventLogs({
      abi: daoSpaceFactoryImplementationAbi,
      logs: logs as Log[],
      eventName: 'SpaceCreated',
    });

    if (spaceCreatedEvents.length > 0) {
      return spaceCreatedEvents[0];
    }
    return undefined;
  } catch (error) {
    console.error('Failed to parse SpaceCreated event:', error);
    return undefined;
  }
};

export const getSpaceFromLogs = (logs: unknown[]) => {
  const event = getSpaceCreatedEvent(logs);
  if (event) {
    return event.args;
  }
  return undefined;
};
