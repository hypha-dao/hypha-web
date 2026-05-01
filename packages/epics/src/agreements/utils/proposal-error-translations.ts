export type ProposalErrorTranslation = {
  key: string;
  values?: Record<string, string | number>;
};

const PROPOSAL_ERROR_KEY_MAP: Record<string, string> = {
  'Please add a title for your proposal':
    'issueNewTokenForm.errors.titleRequired',
  'Please add content to your proposal':
    'issueNewTokenForm.errors.descriptionRequired',
  'Title cannot exceed 50 characters (including spaces)':
    'issueNewTokenForm.errors.titleMaxLength',
  'Description cannot exceed 4000 characters (including spaces)':
    'issueNewTokenForm.errors.descriptionMaxLength',
  'Slug must contain only lowercase letters, numbers, and hyphens':
    'issueNewTokenForm.errors.slugFormat',
  'Please upload a valid file': 'issueNewTokenForm.errors.uploadValidFile',
  'Your file is too large and exceeds the 4MB limit. Please upload a smaller file.':
    'issueNewTokenForm.errors.fileTooLarge',
  'Your file is too large and exceeds the 4MB limit. Please upload a smaller file':
    'issueNewTokenForm.errors.fileTooLarge',
  'File must be an image (JPEG, PNG, GIF, WEBP).':
    'issueNewTokenForm.errors.imageFileType',
  'File must be an image (JPEG, PNG, GIF, WEBP)':
    'issueNewTokenForm.errors.imageFileType',
  'Lead Image URL must be a valid URL':
    'issueNewTokenForm.errors.leadImageUrlInvalid',
  'Attachment URL must be a valid URL':
    'issueNewTokenForm.errors.attachmentUrlInvalid',
  'Attachment name is required':
    'issueNewTokenForm.errors.attachmentNameRequired',
  'You can attach up to 3 files. Please remove the extra attachments.':
    'issueNewTokenForm.errors.attachmentsLimit',
  'Please add a recipient or wallet address':
    'proposalErrors.recipientRequired',
  'Recipient is required': 'proposalErrors.recipientRequired',
  'Invalid Ethereum address': 'proposalErrors.invalidEthereumAddress',
  'Amount must be greater than 0': 'proposalErrors.amountGreaterThanZero',
  'Amount is required': 'proposalErrors.amountRequired',
  /** Payout rows — matches `schemaPayoutRow` / `payoutRowField` Zod messages */
  'Please enter an amount.': 'proposalErrors.enterAmountPrompt',
  'Please select a token': 'proposalErrors.tokenRequired',
  'Token is required': 'proposalErrors.tokenRequired',
  'At least one payout is required': 'proposalErrors.atLeastOnePayoutRequired',
  'Please enter a purchase amount.': 'proposalErrors.purchaseAmountRequired',
  'Please select a space to activate.': 'proposalErrors.selectSpaceToActivate',
  'Please enter the number of months to activate.':
    'proposalErrors.monthsToActivateRequired',
  'Please select a space to join': 'proposalErrors.selectSpaceToJoin',
  'Please select a delegated voting member':
    'proposalErrors.selectDelegatedVotingMember',
  'Please select a space to exit.': 'proposalErrors.selectSpaceToExit',
  'Please select a member to remove': 'proposalErrors.selectMemberToRemove',
  'Invalid wallet address': 'proposalErrors.invalidWalletAddress',
  'Please select a member.': 'proposalErrors.selectMember',
  'Invalid member address.': 'proposalErrors.invalidMemberAddress',
  'Please specify a positive number of tokens.':
    'proposalErrors.positiveTokenNumberRequired',
  'Please select a member and specify the number of tokens to allocate.':
    'proposalErrors.selectMemberAndTokens',
  'Auto-execution is disabled. Please set a minimum voting duration.':
    'proposalErrors.autoExecutionVotingDurationRequired',
  'Please select a token to pursue with this voting method.':
    'proposalErrors.selectVotingToken',
  'Please select a backing collateral':
    'proposalErrors.backingCollateralRequired',
  'Please enter amount': 'proposalErrors.enterAmount',
  'Enter an amount to continue.': 'proposalErrors.enterAmount',
  'Invalid token address': 'proposalErrors.invalidTokenAddress',
  'Invalid address': 'proposalErrors.invalidAddress',
  'Token address is required': 'proposalErrors.tokenAddressRequired',
  'Should be integer': 'proposalErrors.integerRequired',
  'Choose a token to mint': 'proposalErrors.chooseTokenToMint',
  'Choose a token to burn': 'proposalErrors.chooseTokenToBurn',
  'At least one burn target is required':
    'proposalErrors.atLeastOneBurnTargetRequired',
  'Milestones cannot be empty':
    'plugins.paymentSchedule.errors.milestonesEmpty',
  'Each milestone must have a start date':
    'plugins.paymentSchedule.errors.missingStartDate',
  'First milestone must be in the future':
    'plugins.paymentSchedule.errors.firstMilestoneFuture',
  'Total percentage cannot exceed 100%':
    'plugins.paymentSchedule.errors.totalPercentageMax',
  'The future payment date must be later than the current date':
    'plugins.paymentSchedule.errors.futureDateMustBeLater',
  'Token price is required when redemption is active. Enter a price greater than 0.':
    'proposalErrors.redemptionTokenPriceRequired',
  'Reference currency is required when redemption is active.':
    'proposalErrors.redemptionReferenceCurrencyRequired',
  'Maximum Redemption % is required when redemption is active. Enter 0 for no limit.':
    'proposalErrors.redemptionMaxPercentRequired',
  'Period (days) is required when Redemption is active. Select a redemption period.':
    'proposalErrors.redemptionPeriodDaysRequired',
  'Authorise Redemption from date is required when Redemption is active.':
    'proposalErrors.redemptionStartDateRequired',
  'Exactly one token row is required under Investing member will send':
    'proposalErrors.acceptInvestmentExactSendRows',
  'Exactly one token row is required under Investing Member will Receive':
    'proposalErrors.acceptInvestmentExactReceiveRows',
};

export const resolveProposalErrorTranslation = (
  message: string,
): ProposalErrorTranslation | null => {
  const trimmedMessage = message.trim();

  const tooLargeMatch = trimmedMessage.match(
    /^Your file "(.+)" is too large and exceeds the 4MB limit\. Please upload a smaller file\.$/,
  );
  if (tooLargeMatch?.[1]) {
    return {
      key: 'issueNewTokenForm.errors.attachmentFileTooLarge',
      values: { fileName: tooLargeMatch[1] },
    };
  }

  const unsupportedFormatMatch = trimmedMessage.match(
    /^This file "(.+)" format isn’t supported\. Please upload a JPEG, PNG, WebP, or PDF \(up to 4MB\)\.$/,
  );
  if (unsupportedFormatMatch?.[1]) {
    return {
      key: 'issueNewTokenForm.errors.attachmentFileTypeUnsupported',
      values: { fileName: unsupportedFormatMatch[1] },
    };
  }

  const milestoneOrderMatch = trimmedMessage.match(
    /^Milestone (\d+) must be after milestone (\d+)$/,
  );
  if (milestoneOrderMatch?.[1] && milestoneOrderMatch?.[2]) {
    return {
      key: 'plugins.paymentSchedule.errors.milestoneOrder',
      values: {
        current: Number(milestoneOrderMatch[1]),
        previous: Number(milestoneOrderMatch[2]),
      },
    };
  }

  const key = PROPOSAL_ERROR_KEY_MAP[trimmedMessage];
  return key ? { key } : null;
};
