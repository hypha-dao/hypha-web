export class SpaceNotFoundError extends Error {
  constructor(idOrSlug: number | string) {
    super(
      `Space with ${
        typeof idOrSlug === 'number' ? 'id' : 'slug'
      } ${idOrSlug} not found`,
    );
    this.name = 'SpaceNotFoundError';
  }
}

export class DuplicateSlugError extends Error {
  constructor(slug: string) {
    super(`Space with slug ${slug} already exists`);
    this.name = 'DuplicateSlugError';
  }
}

export class InvalidSpaceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSpaceDataError';
  }
}

export class Web2SpaceCreationError extends Error {
  constructor(message?: string) {
    super(message || 'Could not create web2 space');
    this.name = 'Web2SpaceCreationError';
  }
}

export class Web3SpaceCreationError extends Error {
  constructor(message?: string) {
    super(message || 'Could not create web3 space');
    this.name = 'Web3SpaceCreationError';
  }
}

export class Web3SpaceNotFoundInTransactionLog extends Error {
  constructor(hash: `0x${string}`) {
    const message = `transaction (${hash}) logs do not contain SpaceCreatedEvent`;
    super(message);
    this.name = 'Web3SpaceNotFoundInTransactionLog';
  }
}

export class SpaceLinkingError extends Error {
  constructor(message?: string) {
    super(message || 'Failed to link web2 and web3 spaces');
    this.name = 'SpaceLinkingError';
  }
}
