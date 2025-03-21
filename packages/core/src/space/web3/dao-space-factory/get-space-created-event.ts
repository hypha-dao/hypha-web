import { parseEventLogs } from 'viem';
import { daoSpaceFactoryImplementationAbi } from '../../../generated';

/**
 * Extract the SpaceCreated event from transaction logs
 * @param logs - The transaction logs to parse
 * @returns The SpaceCreated event if found, undefined otherwise
 */
export const getSpaceCreatedEvent = (logs: any[]) => {
  try {
    // Parse logs for the specific event
    const spaceCreatedEvents = parseEventLogs({
      abi: daoSpaceFactoryImplementationAbi,
      logs,
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

/**
 * Get the spaceId from transaction logs
 * @param logs - The transaction logs to parse
 * @returns The spaceId as a number if found, undefined otherwise
 */
export const getSpaceIdFromLogs = (logs: any[]) => {
  const event = getSpaceCreatedEvent(logs);
  if (event) {
    return Number(event.args.spaceId);
  }
  return undefined;
};
