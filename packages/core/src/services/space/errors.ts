export class SpaceNotFoundError extends Error {
  constructor(id: string) {
    super(`Space with id ${id} not found`);
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
