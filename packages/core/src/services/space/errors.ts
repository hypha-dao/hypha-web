export class SpaceNotFoundError extends Error {
  constructor(idOrSlug: number | string) {
    super(
      `Space with ${typeof idOrSlug === 'number' ? 'id' : 'slug'} ${idOrSlug} not found`,
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
