/**
 * Maps proposal `document.label` schema literals to nested keys under `AgreementFlow`
 * for document list badges (same English copy as legacy literals).
 */
export const DOCUMENT_LABEL_BADGE_KEYS: Partial<Record<string, string>> = {
  Contribution: 'labels.contribution',
  'Collective Agreement': 'labels.collectiveAgreement',
  Expenses: 'labels.expenses',
  Funding: 'labels.funding',
  'Voting Method': 'labels.votingMethod',
  'Entry Method': 'labels.entryMethod',
  'Issue New Token': 'labels.issueNewToken',
  Invite: 'documentBadges.invite',
  'Buy Hypha Tokens': 'documentBadges.buyHyphaTokens',
  'Activate Spaces': 'labels.activateSpaces',
  'Space To Space': 'labels.spaceToSpace',
  'Space Transparency': 'labels.spaceTransparency',
  'Treasury Minting': 'labels.treasuryMinting',
  'Token Burning': 'labels.tokenBurning',
  'Backing Vault': 'labels.backingVault',
  'Redeem Tokens': 'documentBadges.redeemTokens',
  'Token Purchase': 'labels.spaceTokenPurchase',
  'Update Token': 'documentBadges.updateToken',
  Investment: 'labels.investment',
  Exchange: 'labels.exchange',
  'Membership Exit': 'labels.membershipExit',
  'Energy Sharing': 'labels.energySharing',
  'Register Energy Source': 'labels.registerEnergySource',
  'Add Energy Member': 'labels.addEnergyMember',
};
