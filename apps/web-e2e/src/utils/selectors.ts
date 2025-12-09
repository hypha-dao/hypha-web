/**
 * Common Selectors and Test IDs
 *
 * Centralized location for all test selectors.
 * Use these when adding data-testid attributes to components.
 */

export const SELECTORS = {
  // Authentication
  auth: {
    loginButton: 'login-button',
    signInButton: 'sign-in-button',
    profileButton: 'profile-button',
    logoutButton: 'logout-button',
  },

  // Navigation
  nav: {
    menuTop: 'menu-top',
    networkLink: 'nav-network',
    mySpacesLink: 'nav-my-spaces',
    footer: 'footer',
  },

  // Spaces
  spaces: {
    memberSpacesContainer: 'member-spaces-container',
    recommendedSpacesContainer: 'recommended-spaces-container',
    spaceCard: 'space-card',
    spaceTitle: 'space-title',
    spaceLogo: 'space-logo',
    spaceDescription: 'space-description',
    memberCount: 'member-count',
    agreementCount: 'agreement-count',
    joinSpaceButton: 'join-space-button',
    settingsButton: 'settings-button',
  },

  // Proposals/Agreements
  proposals: {
    proposalCard: 'proposal-card',
    proposalTitle: 'proposal-title',
    proposalDescription: 'proposal-description',
    proposalCreator: 'proposal-creator',
    proposalStatus: 'proposal-status',
    proposalCreatedDate: 'proposal-created-date',
    proposalEndDate: 'proposal-end-date',
    commitmentBadge: 'commitment-badge',
  },

  // Voting
  voting: {
    votingForm: 'voting-form',
    voteYesButton: 'vote-yes-button',
    voteNoButton: 'vote-no-button',
    unityProgress: 'unity-progress',
    quorumProgress: 'quorum-progress',
    unityPercentage: 'unity-percentage',
    quorumPercentage: 'quorum-percentage',
    timeRemaining: 'time-remaining',
    voterList: 'voter-list',
  },

  // Forms
  forms: {
    proposalTitleInput: 'proposal-title-input',
    proposalDescriptionEditor: 'proposal-description-editor',
    commitmentInput: 'commitment-input',
    publishButton: 'publish-button',
    closeButton: 'close-button',
    backButton: 'back-button',
    loadingBackdrop: 'loading-backdrop',
  },

  // Creator/Person
  person: {
    creatorAvatar: 'creator-avatar',
    creatorName: 'creator-name',
    personAvatar: 'person-avatar',
    personName: 'person-name',
  },

  // Loading states
  loading: {
    skeleton: 'skeleton',
    spinner: 'spinner',
    loadingBackdrop: 'loading-backdrop',
  },
} as const;

/**
 * Helper to create data-testid selector string
 */
export function testId(id: string): string {
  return `[data-testid="${id}"]`;
}

/**
 * Helper to get aria role selector
 */
export function role(
  roleName: string,
  options?: { name?: string | RegExp },
): string {
  if (options?.name) {
    return `role=${roleName}[name="${options.name}"]`;
  }
  return `role=${roleName}`;
}
