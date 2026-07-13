/** MatrixRTC session event names (matrix-js-sdk MatrixRTCSessionEvent). */
export const MATRIX_RTC_SESSION_EVENT = {
  MembershipsChanged: 'memberships_changed',
  JoinStateChanged: 'join_state_changed',
  EncryptionKeyChanged: 'encryption_key_changed',
  MembershipManagerError: 'membership_manager_error',
  DidSendCallNotification: 'did_send_call_notification',
} as const;

export type MatrixRtcSessionLike = {
  isJoined(): boolean;
  memberships: Array<{
    sender: string;
    isExpired(): boolean;
  }>;
  joinRoomSession(
    fociPreferred: Array<{ type: string; livekit_service_url?: string }>,
    multiSfuFocus?: { type: string; livekit_service_url?: string },
    joinConfig?: { manageMediaKeys?: boolean; callIntent?: string },
  ): void;
  leaveRoomSession(timeout?: number): Promise<boolean>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
};
